function [results] = modal_plant_simulate(t, F_ice, params, theta)
%==========================================================================
% modal_plant_simulate.m
% 艏部等效模态动力学模型 — 状态空间仿真
%
% M*x'' + C*x' + K*x = B*F_ice(t)
% 转换为状态空间: z' = A*z + B_ss*u, y = C_ss*z + D_ss*u
%
% 输入:
%   t       - 时间向量 (s)
%   F_ice   - 冰冲击载荷 (N)
%   params  - 系统参数结构体
%   theta   - 阻尼强化层参数 {t_d, E_d, eta_d, Omega}
%
% 输出:
%   results - 结构体, 包含各响应时间历程和性能指标
%==========================================================================

n = params.n_modes;
fn_base   = params.fn_base(1:n);
zeta_base = params.zeta_base(1:n);
m_modal   = params.m_modal(1:n);
B_force   = params.B_force(1:n);
stress_c  = params.stress_coeff(1:n);

%% ---- 应用阻尼强化层 ----
if theta.t_d > 0 && theta.E_d > 0
    % 刚度增量 (限制在合理范围)
    base_stiffness = m_modal .* (2*pi*fn_base).^2;
    k_add = theta.E_d * theta.t_d * theta.Omega * 0.001;
    k_add_ratio = min(k_add ./ base_stiffness, 0.3);
    
    % 阻尼增量
    zeta_add_base = theta.eta_d * theta.Omega * (theta.t_d / 0.01) * 0.05;
    decay_vec = [1.0, 0.9, 0.7, 0.5, 0.3];
    zeta_add = min(zeta_add_base * decay_vec(1:n), 0.15);
    
    fn   = fn_base .* sqrt(1 + k_add_ratio);
    zeta = zeta_base + zeta_add;
else
    fn   = fn_base;
    zeta = zeta_base;
end

wn = 2 * pi * fn;

%% ---- 构建状态空间模型 ----
% 状态: z = [x1; x1_dot; x2; x2_dot; ... ; xn; xn_dot]
A_ss  = zeros(2*n, 2*n);
B_ss  = zeros(2*n, 1);
C_disp = zeros(n, 2*n);
C_vel  = zeros(n, 2*n);

for i = 1:n
    idx = 2*(i-1) + 1;
    A_ss(idx,   idx+1) = 1;
    A_ss(idx+1, idx)   = -wn(i)^2;
    A_ss(idx+1, idx+1) = -2*zeta(i)*wn(i);
    B_ss(idx+1, 1)     = B_force(i) / m_modal(i);
    C_disp(i, idx)     = 1;
    C_vel(i,  idx+1)   = 1;
end

D_ss = zeros(n, 1);

%% ---- 状态空间仿真 (lsim) ----
sys_disp = ss(A_ss, B_ss, C_disp, D_ss);
sys_vel  = ss(A_ss, B_ss, C_vel,  D_ss);

[y_disp, ~] = lsim(sys_disp, F_ice, t);  % n列, 每列一个模态
[y_vel,  ~] = lsim(sys_vel,  F_ice, t);

% 加速度 (数值微分)
dt = t(2) - t(1);
y_acc = gradient(y_vel, dt);  % 逐列微分, 近似

% 应力恢复
y_stress = y_disp .* stress_c;  % 广播: (N_time x n) .* (1 x n)

%% ---- 总响应 (模态叠加) ----
disp_total   = sum(y_disp, 2);
vel_total    = sum(y_vel, 2);
acc_total    = sum(y_acc, 2);
stress_total = sum(y_stress, 2);

%% ---- 性能指标 ----
% 峰值
results.max_acc    = max(abs(acc_total));
results.max_disp   = max(abs(disp_total));
results.max_stress = max(abs(stress_total));
results.max_vel    = max(abs(vel_total));

% RMS
results.rms_acc    = rms(acc_total);
results.rms_disp   = rms(disp_total);
results.rms_stress = rms(stress_total);

% 频带能量 (1-50 Hz)
fs = 1/dt;
[Pxx, f_psd] = pwelch(acc_total, min(2048, floor(length(t)/4)), [], [], fs);
mask = (f_psd >= 1) & (f_psd <= 50);
band_energy  = trapz(f_psd(mask), Pxx(mask));
total_energy = trapz(f_psd, Pxx);
results.band_energy  = band_energy;
results.total_energy = total_energy;
results.band_ratio   = band_energy / (total_energy + 1e-20);

% 冲击能量
E_input = abs(trapz(t, F_ice .* vel_total));
E_kinetic_peak = 0.5 * max(vel_total.^2) * m_modal(1);
E_strain = abs(trapz(t, stress_total .* disp_total));
results.E_input = E_input;
results.E_kinetic = E_kinetic_peak;
results.E_strain  = E_strain;
results.absorption_ratio = E_strain / (E_input + 1e-10);

% 简化雨流计数 → DEL
[DEL, n_cycles, ranges] = simplified_rainflow(stress_total, 3.0);
results.DEL      = DEL;
results.n_cycles = n_cycles;
results.ranges   = ranges;

% 目标函数
a_ref = 500; sigma_ref = 2e8; DEL_ref = 1e8;
results.J = 0.3*results.max_acc/a_ref + ...
            0.4*results.max_stress/sigma_ref + ...
            0.3*DEL/DEL_ref;

% 存储时间历程
results.t            = t;
results.F_ice        = F_ice;
results.disp_modal   = y_disp;
results.vel_modal    = y_vel;
results.acc_modal    = y_acc;
results.stress_modal = y_stress;
results.disp_total   = disp_total;
results.vel_total    = vel_total;
results.acc_total    = acc_total;
results.stress_total = stress_total;
results.fn           = fn;
results.zeta         = zeta;
results.f_psd        = f_psd;
results.Pxx          = Pxx;

end

%% ===== 子函数: 简化雨流计数 =====
function [DEL, n_cycles, ranges] = simplified_rainflow(stress, m)
% 简化雨流计数 + 等效疲劳载荷 (DEL)
% 基于峰谷提取 + 范围配对

N = length(stress);
peaks = [];
for i = 2:N-1
    if (stress(i) > stress(i-1) && stress(i) > stress(i+1)) || ...
       (stress(i) < stress(i-1) && stress(i) < stress(i+1))
        peaks = [peaks; stress(i)]; %#ok<AGROW>
    end
end

if length(peaks) < 2
    DEL = 0; n_cycles = 0; ranges = [];
    return;
end

ranges = abs(diff(peaks));
n_cycles = length(ranges);
DEL = (sum(ranges.^m) / n_cycles)^(1/m);

end
