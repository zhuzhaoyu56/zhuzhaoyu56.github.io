function [case_results] = run_workload_matrix(params)
%==========================================================================
% run_workload_matrix.m
% 全工况矩阵仿真: 航速 × 冰厚 × 冲击角
%==========================================================================

speeds     = [3.0, 5.0, 8.0];     % m/s
thicknesses = [0.5, 1.0, 1.5];    % m
angles     = [15, 30, 45];         % degrees

theta_none = struct('t_d', 0, 'E_d', 0, 'eta_d', 0, 'Omega', 0);
case_id = 0;
case_results = [];

for iv = 1:length(speeds)
    for ih = 1:length(thicknesses)
        for ia = 1:length(angles)
            case_id = case_id + 1;
            
            % 只对 alpha=30° 做完整仿真以节省时间
            if angles(ia) ~= 30
                continue;
            end
            
            p = params;
            p.V_ship  = speeds(iv);
            p.h_ice   = thicknesses(ih);
            p.alpha   = angles(ia);
            p.T_total = 5.0;  % 短时仿真
            
            [t_k, F_k, ~] = ice_load_generator(p, 'cluster', case_id*10);
            res_k = modal_plant_simulate(t_k, F_k, p, theta_none);
            
            res_k.case_id   = case_id;
            res_k.speed     = speeds(iv);
            res_k.thickness = thicknesses(ih);
            res_k.angle     = angles(ia);
            res_k.label     = sprintf('V=%.1f, h=%.1f, α=%d°', ...
                speeds(iv), thicknesses(ih), angles(ia));
            
            case_results = [case_results; res_k]; %#ok<AGROW>
            
            fprintf('    Case %2d: %s → max|a|=%.1f, max|σ|=%.1f MPa\n', ...
                case_id, res_k.label, res_k.max_acc, res_k.max_stress/1e6);
        end
    end
end

end
