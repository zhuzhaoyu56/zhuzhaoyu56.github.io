function [t, F_total, impact_times] = ice_load_generator(params, mode, seed)
%==========================================================================
% ice_load_generator.m
% 冰排间歇冲击载荷发生器
% 
% 载荷模板: "冲击脉冲(半正弦上升) + 压碎平台 + 指数衰减尾部"
% 随机过程: 泊松到达 / 团簇冲击
%
% 输入:
%   params  - 参数结构体 (V_ship, h_ice, alpha, sigma_ice, A_contact, dt, T_total)
%   mode    - 'poisson' 或 'cluster'
%   seed    - 随机种子
%
% 输出:
%   t             - 时间向量 (s)
%   F_total       - 总冰冲击力时间历程 (N)
%   impact_times  - 各次冲击到达时刻 (s)
%==========================================================================

if nargin < 2, mode = 'cluster'; end
if nargin < 3, seed = 42; end

rng(seed);

dt      = params.dt;
T_total = params.T_total;
t       = (0:dt:T_total-dt)';
N       = length(t);
F_total = zeros(N, 1);

% ---- 计算冰冲击峰值力 (ISO 19906 简化) ----
alpha_rad = deg2rad(params.alpha);
p = params.sigma_ice * sqrt(params.h_ice / 1.0);  % 压力
v_factor = 1.0 + 0.1 * params.V_ship;
F_peak_base = p * params.A_contact * cos(alpha_rad) * v_factor;

% ---- 泊松到达率 ----
lambda_rate = 3.0;  % 次/秒

% ---- 生成冲击到达时间 ----
switch lower(mode)
    case 'poisson'
        n_impacts = poissrnd(lambda_rate * T_total);
        impact_times = sort(rand(n_impacts, 1) * T_total * 0.9);
        
    case 'cluster'
        % 团簇冲击: 多个短簇, 每簇内高频冲击
        n_clusters = max(1, poissrnd(lambda_rate * T_total / 5));
        impact_times = [];
        for k = 1:n_clusters
            t_cluster = rand() * T_total * 0.85;
            n_in_cluster = randi([3, 8]);
            times_in = t_cluster + cumsum(exprnd(0.08, n_in_cluster, 1));
            times_in = times_in(times_in < T_total * 0.95);
            impact_times = [impact_times; times_in]; %#ok<AGROW>
        end
        impact_times = sort(impact_times);
        
    otherwise
        error('Unknown mode: %s', mode);
end

% ---- 为每次冲击生成脉冲 ----
for k = 1:length(impact_times)
    t_imp = impact_times(k);
    
    % 随机化冲击参数
    F_peak_k  = F_peak_base * (0.6 + 0.8 * rand());
    t_rise    = 0.005 + 0.015 * rand();
    t_plateau = 0.01  + 0.03  * rand();
    t_decay   = 0.02  + 0.05  * rand();
    
    % 生成单次冲击脉冲
    F_pulse = single_impact_pulse(t, t_imp, F_peak_k, t_rise, t_plateau, t_decay);
    F_total = F_total + F_pulse;
end

end

%% ===== 子函数: 单次冲击脉冲 =====
function F = single_impact_pulse(t, t_start, F_peak, t_rise, t_plateau, t_decay)
% 单次冲击: 半正弦上升 + 压碎平台 + 指数衰减尾部

F = zeros(size(t));
dt_vec = t - t_start;

% 上升段: 半正弦
mask_rise = (dt_vec >= 0) & (dt_vec < t_rise);
F(mask_rise) = F_peak * sin(pi/2 * dt_vec(mask_rise) / t_rise);

% 压碎平台段 (带小幅随机扰动)
mask_plateau = (dt_vec >= t_rise) & (dt_vec < t_rise + t_plateau);
n_plat = sum(mask_plateau);
noise = 0.85 + 0.15 * 0.1 * randn(n_plat, 1);
F(mask_plateau) = F_peak * max(0.7, min(1.1, noise));

% 衰减尾部: 指数衰减
mask_decay = (dt_vec >= t_rise + t_plateau) & (dt_vec < t_rise + t_plateau + t_decay);
dt_d = dt_vec(mask_decay) - (t_rise + t_plateau);
F(mask_decay) = F_peak * 0.85 * exp(-3.0 * dt_d / t_decay);

end
