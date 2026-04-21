%==========================================================================
% build_simulink_model.m
% 程序化构建 Simulink 仿真模型
% 
% 模块结构:
%   [Ice Load Generator] → [Modal Plant (State-Space)] → [Stress Recovery]
%                                                       → [Performance Evaluator]
%
% 使用方法: 在 MATLAB 命令窗口运行此脚本即可自动生成 .slx 模型文件
%==========================================================================
clear; clc;

model_name = 'IceImpact_BowResponse_Model';

%% ---- 删除已存在的模型 ----
if bdIsLoaded(model_name)
    close_system(model_name, 0);
end
if exist([model_name '.slx'], 'file')
    delete([model_name '.slx']);
end

%% ---- 创建新模型 ----
new_system(model_name);
open_system(model_name);

%% ===== 模块参数 =====
n_modes = 5;
fn   = [18.5, 35.2, 58.7, 89.3, 125.0];
zeta = [0.015, 0.012, 0.010, 0.008, 0.007];
m_m  = [1200, 800, 500, 350, 250];
B_f  = [1.0, 0.7, 0.4, 0.2, 0.1];
sc   = [2.5e8, 1.8e8, 1.2e8, 0.8e8, 0.5e8];

wn = 2*pi*fn;

% 构建状态空间矩阵
A_ss = zeros(2*n_modes);
B_ss = zeros(2*n_modes, 1);
C_disp = zeros(n_modes, 2*n_modes);
C_acc  = zeros(n_modes, 2*n_modes);

for i = 1:n_modes
    idx = 2*(i-1)+1;
    A_ss(idx, idx+1)   = 1;
    A_ss(idx+1, idx)   = -wn(i)^2;
    A_ss(idx+1, idx+1) = -2*zeta(i)*wn(i);
    B_ss(idx+1, 1)     = B_f(i)/m_m(i);
    C_disp(i, idx)     = 1;
    % 加速度 = -wn^2*x - 2*zeta*wn*xdot + B/m*u (直接从状态方程)
    C_acc(i, idx)   = -wn(i)^2;
    C_acc(i, idx+1) = -2*zeta(i)*wn(i);
end
D_disp = zeros(n_modes, 1);
D_acc  = B_ss;  % D_acc(i) = B_f(i)/m_m(i)

%% ===== 1. Ice Load Generator (MATLAB Function Block) =====
pos_ice = [80, 150, 250, 230];
add_block('simulink/User-Defined Functions/MATLAB Function', ...
    [model_name '/IceLoadGenerator'], 'Position', pos_ice);

% 设置 MATLAB Function 代码
ice_fcn_code = sprintf([...
    'function F_ice = IceLoadGenerator(t)\n' ...
    '%% 冰冲击载荷发生器 (简化版 — Simulink内嵌)\n' ...
    '%% 使用预计算的冲击序列\n' ...
    'persistent impact_data;\n' ...
    'if isempty(impact_data)\n' ...
    '    %% 预生成冲击参数\n' ...
    '    rng(42);\n' ...
    '    F_peak_base = 2.5e6 * 2.0 * cos(deg2rad(30)) * 1.5;\n' ...
    '    n_impacts = 30;\n' ...
    '    impact_data.times = sort(rand(n_impacts,1)*9);\n' ...
    '    impact_data.peaks = F_peak_base * (0.6+0.8*rand(n_impacts,1));\n' ...
    '    impact_data.t_rise = 0.005+0.015*rand(n_impacts,1);\n' ...
    '    impact_data.t_plat = 0.01+0.03*rand(n_impacts,1);\n' ...
    '    impact_data.t_decay = 0.02+0.05*rand(n_impacts,1);\n' ...
    'end\n' ...
    'F_ice = 0;\n' ...
    'for k = 1:length(impact_data.times)\n' ...
    '    dt_k = t - impact_data.times(k);\n' ...
    '    tr = impact_data.t_rise(k);\n' ...
    '    tp = impact_data.t_plat(k);\n' ...
    '    td = impact_data.t_decay(k);\n' ...
    '    Fp = impact_data.peaks(k);\n' ...
    '    if dt_k >= 0 && dt_k < tr\n' ...
    '        F_ice = F_ice + Fp*sin(pi/2*dt_k/tr);\n' ...
    '    elseif dt_k >= tr && dt_k < tr+tp\n' ...
    '        F_ice = F_ice + Fp*0.85;\n' ...
    '    elseif dt_k >= tr+tp && dt_k < tr+tp+td\n' ...
    '        F_ice = F_ice + Fp*0.85*exp(-3*(dt_k-tr-tp)/td);\n' ...
    '    end\n' ...
    'end\n']);

% 注意: MATLAB Function Block 的代码需要通过 Stateflow API 设置
% 这里展示手动步骤, 实际中需 open_system 后手动编辑
fprintf('Note: Manually paste IceLoadGenerator code into the MATLAB Function block.\n');

%% ===== 2. Modal Plant (State-Space Block) =====
% 位移输出
pos_ss_disp = [400, 100, 550, 180];
add_block('simulink/Continuous/State-Space', ...
    [model_name '/ModalPlant_Disp'], 'Position', pos_ss_disp);
set_param([model_name '/ModalPlant_Disp'], ...
    'A', mat2str(A_ss), ...
    'B', mat2str(B_ss), ...
    'C', mat2str(C_disp), ...
    'D', mat2str(D_disp), ...
    'X0', mat2str(zeros(2*n_modes,1)));

% 加速度输出
pos_ss_acc = [400, 220, 550, 300];
add_block('simulink/Continuous/State-Space', ...
    [model_name '/ModalPlant_Acc'], 'Position', pos_ss_acc);
set_param([model_name '/ModalPlant_Acc'], ...
    'A', mat2str(A_ss), ...
    'B', mat2str(B_ss), ...
    'C', mat2str(C_acc), ...
    'D', mat2str(reshape(B_ss, 1, [])), ...
    'X0', mat2str(zeros(2*n_modes,1)));

%% ===== 3. Stress Recovery (Gain Block) =====
pos_stress = [650, 100, 780, 180];
add_block('simulink/Math Operations/Gain', ...
    [model_name '/StressRecovery'], 'Position', pos_stress);
set_param([model_name '/StressRecovery'], ...
    'Gain', mat2str(diag(sc)), ...
    'Multiplication', 'Matrix(K*u)');

%% ===== 4. Sum Blocks (模态叠加) =====
% 位移总和
pos_sum_disp = [720, 100, 750, 130];
add_block('simulink/Math Operations/Sum', ...
    [model_name '/SumDisp'], 'Position', pos_sum_disp + [120 0 120 0]);
set_param([model_name '/SumDisp'], 'Inputs', repmat('+', 1, n_modes));

% 加速度总和
pos_sum_acc = [720, 220, 750, 250];
add_block('simulink/Math Operations/Sum', ...
    [model_name '/SumAcc'], 'Position', pos_sum_acc + [120 0 120 0]);
set_param([model_name '/SumAcc'], 'Inputs', repmat('+', 1, n_modes));

%% ===== 5. Scope / To Workspace Blocks =====
% Ice Load scope
add_block('simulink/Sinks/Scope', ...
    [model_name '/Scope_IceLoad'], 'Position', [300, 300, 340, 340]);

% Displacement workspace
add_block('simulink/Sinks/To Workspace', ...
    [model_name '/ToWS_Disp'], 'Position', [950, 100, 1050, 130]);
set_param([model_name '/ToWS_Disp'], 'VariableName', 'disp_out', 'SaveFormat', 'Timeseries');

% Acceleration workspace
add_block('simulink/Sinks/To Workspace', ...
    [model_name '/ToWS_Acc'], 'Position', [950, 220, 1050, 250]);
set_param([model_name '/ToWS_Acc'], 'VariableName', 'acc_out', 'SaveFormat', 'Timeseries');

% Stress workspace
add_block('simulink/Sinks/To Workspace', ...
    [model_name '/ToWS_Stress'], 'Position', [950, 160, 1050, 190]);
set_param([model_name '/ToWS_Stress'], 'VariableName', 'stress_out', 'SaveFormat', 'Timeseries');

% Ice Load workspace
add_block('simulink/Sinks/To Workspace', ...
    [model_name '/ToWS_Ice'], 'Position', [300, 360, 400, 390]);
set_param([model_name '/ToWS_Ice'], 'VariableName', 'ice_load', 'SaveFormat', 'Timeseries');

%% ===== 6. Clock Block =====
add_block('simulink/Sources/Clock', ...
    [model_name '/Clock'], 'Position', [30, 170, 60, 200]);

%% ===== 7. 连线 =====
% Clock → IceLoadGenerator
add_line(model_name, 'Clock/1', 'IceLoadGenerator/1');

% IceLoadGenerator → ModalPlant_Disp
add_line(model_name, 'IceLoadGenerator/1', 'ModalPlant_Disp/1');
% IceLoadGenerator → ModalPlant_Acc  
add_line(model_name, 'IceLoadGenerator/1', 'ModalPlant_Acc/1');
% IceLoadGenerator → Scope
add_line(model_name, 'IceLoadGenerator/1', 'Scope_IceLoad/1');
% IceLoadGenerator → ToWS_Ice
add_line(model_name, 'IceLoadGenerator/1', 'ToWS_Ice/1');

% ModalPlant_Disp → StressRecovery
add_line(model_name, 'ModalPlant_Disp/1', 'StressRecovery/1');

% StressRecovery → ToWS_Stress
add_line(model_name, 'StressRecovery/1', 'ToWS_Stress/1');

% ModalPlant_Disp → SumDisp → ToWS_Disp
% (注: 需要 Demux 将向量拆分再求和, 或直接用 MATLAB Fcn 求和)

%% ===== 8. 仿真参数设置 =====
set_param(model_name, ...
    'Solver', 'ode45', ...
    'StopTime', '10', ...
    'MaxStep', '0.001', ...
    'RelTol', '1e-6', ...
    'AbsTol', '1e-8');

%% ===== 保存模型 =====
save_system(model_name);
fprintf('Simulink model saved: %s.slx\n', model_name);
fprintf('\n========================================\n');
fprintf('模型已创建! 使用步骤:\n');
fprintf('  1. 打开模型: open_system(''%s'')\n', model_name);
fprintf('  2. 双击 IceLoadGenerator 模块, 粘贴冰载荷代码\n');
fprintf('  3. 点击 Run 运行仿真\n');
fprintf('  4. 结果存储在 Workspace: disp_out, acc_out, stress_out, ice_load\n');
fprintf('========================================\n');
