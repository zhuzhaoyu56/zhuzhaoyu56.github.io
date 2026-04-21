%==========================================================================
% main_simulation.m
% 冰排冲击载荷谱 — 艏部等效模态动力学响应 — 阻尼强化层一体化参数设计
% Ice Impact Load Spectrum - Bow Modal Dynamic Response - Damping Layer
% Integrated Parameter Design
%
% 主控脚本: 调用各子模块完成仿真、优化、绘图
%==========================================================================
clear; clc; close all;
fprintf('================================================================\n');
fprintf('  冰排冲击载荷谱 — 艏部模态动力学响应 — 阻尼强化层一体化设计\n');
fprintf('================================================================\n\n');

%% ========== 1. 全局参数设置 ==========
params.dt       = 0.001;       % 时间步长 (s)
params.T_total  = 10.0;        % 仿真总时长 (s)
params.n_modes  = 5;           % 模态数量
params.fs       = 1/params.dt; % 采样率

% 基准工况
params.V_ship   = 5.0;        % 航速 (m/s)
params.h_ice    = 1.0;        % 冰厚 (m)
params.alpha    = 30;          % 冲击角 (degrees)
params.A_contact = 2.0;       % 接触面积 (m^2)
params.sigma_ice = 2.5e6;     % 冰压缩强度 (Pa)

% 模态参数 (艏部壳板+肋骨等效)
params.fn_base   = [18.5, 35.2, 58.7, 89.3, 125.0]; % 自然频率 (Hz)
params.zeta_base = [0.015, 0.012, 0.010, 0.008, 0.007]; % 阻尼比
params.m_modal   = [1200, 800, 500, 350, 250];       % 模态质量 (kg)
params.B_force   = [1.0, 0.7, 0.4, 0.2, 0.1];       % 载荷分配
params.stress_coeff = [2.5e8, 1.8e8, 1.2e8, 0.8e8, 0.5e8]; % 应力恢复系数

%% ========== 2. 生成冰冲击载荷 (基准工况) ==========
fprintf('[1/6] Generating ice impact load...\n');
[t, F_ice, impact_times] = ice_load_generator(params, 'cluster', 42);
fprintf('  Peak force: %.2f MN, Number of impacts: %d\n', ...
    max(F_ice)/1e6, length(impact_times));

%% ========== 3. 基准响应仿真 (无阻尼强化) ==========
fprintf('\n[2/6] Running baseline simulation...\n');
theta_none = struct('t_d', 0, 'E_d', 0, 'eta_d', 0, 'Omega', 0);
[res_base] = modal_plant_simulate(t, F_ice, params, theta_none);
fprintf('  max|a| = %.1f m/s², max|σ| = %.1f MPa\n', ...
    res_base.max_acc, res_base.max_stress/1e6);

%% ========== 4. 阻尼强化层参数优化 ==========
fprintf('\n[3/6] Running damping layer optimization...\n');
[opt_theta, opt_J, opt_history] = optimize_damping_layer(params, t, F_ice);
fprintf('  Optimal: t_d=%.2f mm, E_d=%.2e Pa, eta_d=%.3f, Omega=%.3f\n', ...
    opt_theta.t_d*1000, opt_theta.E_d, opt_theta.eta_d, opt_theta.Omega);
fprintf('  Optimal J = %.4f\n', opt_J);

%% ========== 5. 阻尼强化后仿真 ==========
fprintf('\n[4/6] Running optimized damped simulation...\n');
[res_damp] = modal_plant_simulate(t, F_ice, params, opt_theta);
fprintf('  max|a| = %.1f m/s², max|σ| = %.1f MPa\n', ...
    res_damp.max_acc, res_damp.max_stress/1e6);
fprintf('  Reduction: acc=%.1f%%, stress=%.1f%%\n', ...
    (1 - res_damp.max_acc/res_base.max_acc)*100, ...
    (1 - res_damp.max_stress/res_base.max_stress)*100);

%% ========== 6. 全工况矩阵 ==========
fprintf('\n[5/6] Running workload matrix...\n');
[case_results] = run_workload_matrix(params);

%% ========== 7. 绘图与数据导出 ==========
fprintf('\n[6/6] Generating figures and exporting data...\n');
plot_all_results(t, F_ice, res_base, res_damp, case_results, ...
                 opt_theta, opt_history, params);
export_raw_data(t, F_ice, res_base, res_damp, case_results, ...
                opt_theta, opt_history, params);

fprintf('\n================================================================\n');
fprintf('  ALL DONE! Check the figures and data files.\n');
fprintf('================================================================\n');
