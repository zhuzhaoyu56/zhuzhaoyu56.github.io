function [opt_theta, opt_J, history] = optimize_damping_layer(params, t, F_ice)
%==========================================================================
% optimize_damping_layer.m
% 阻尼强化层参数优化
% theta = {t_d, E_d, eta_d, Omega}
%
% 方法: 拉丁超立方采样 + fmincon 局部优化
%==========================================================================

n_eval = 40;  % 全局采样数

% 参数范围
lb = [0.002,  1e8,  0.05, 0.2];  % [t_d, E_d, eta_d, Omega]
ub = [0.020,  5e9,  0.80, 1.0];

% ---- 拉丁超立方采样 ----
rng(123);
samples = lhsdesign(n_eval, 4);
X = lb + samples .* (ub - lb);

history = struct('x', {}, 'J', {});
best_J = inf;
best_x = lb;

for k = 1:n_eval
    x = X(k, :);
    theta_k = struct('t_d', x(1), 'E_d', x(2), 'eta_d', x(3), 'Omega', x(4));
    
    try
        res = modal_plant_simulate(t, F_ice, params, theta_k);
        J = res.J;
    catch
        J = 1e10;
    end
    
    history(k).x = x;
    history(k).J = J;
    
    if J < best_J
        best_J = J;
        best_x = x;
    end
    
    if mod(k, 10) == 0
        fprintf('    Eval %d/%d, best J = %.4f\n', k, n_eval, best_J);
    end
end

% ---- 局部优化 (fmincon) ----
obj = @(x) eval_objective(x, t, F_ice, params);

options = optimoptions('fmincon', 'Display', 'off', 'MaxIterations', 80, ...
    'Algorithm', 'sqp', 'StepTolerance', 1e-6);

try
    [x_opt, J_opt] = fmincon(obj, best_x, [], [], [], [], lb, ub, [], options);
    if J_opt < best_J
        best_x = x_opt;
        best_J = J_opt;
    end
catch ME
    fprintf('    fmincon warning: %s\n', ME.message);
end

opt_theta = struct('t_d', best_x(1), 'E_d', best_x(2), ...
                   'eta_d', best_x(3), 'Omega', best_x(4));
opt_J = best_J;

end

%% ===== 辅助函数 =====
function J = eval_objective(x, t, F_ice, params)
    theta = struct('t_d', x(1), 'E_d', x(2), 'eta_d', x(3), 'Omega', x(4));
    try
        res = modal_plant_simulate(t, F_ice, params, theta);
        J = res.J;
    catch
        J = 1e10;
    end
end
