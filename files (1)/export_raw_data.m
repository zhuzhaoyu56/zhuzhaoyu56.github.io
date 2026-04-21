function export_raw_data(t, F_ice, res_base, res_damp, case_results, ...
                         opt_theta, opt_history, params)
%==========================================================================
% export_raw_data.m
% 将仿真原始数据导出为 CSV / MAT 文件
%==========================================================================

%% 1. 时域响应 (基准)
step = max(1, floor(length(t)/2000));
idx = 1:step:length(t);
T_base = table(t(idx), F_ice(idx), res_base.disp_total(idx), ...
    res_base.vel_total(idx), res_base.acc_total(idx), res_base.stress_total(idx), ...
    'VariableNames', {'Time_s','IceForce_N','Displacement_m', ...
    'Velocity_ms','Acceleration_ms2','Stress_Pa'});
writetable(T_base, 'data_time_response_baseline.csv');
fprintf('    Saved: data_time_response_baseline.csv\n');

%% 2. 时域响应 (阻尼强化)
T_damp = table(t(idx), F_ice(idx), res_damp.disp_total(idx), ...
    res_damp.vel_total(idx), res_damp.acc_total(idx), res_damp.stress_total(idx), ...
    'VariableNames', {'Time_s','IceForce_N','Displacement_m', ...
    'Velocity_ms','Acceleration_ms2','Stress_Pa'});
writetable(T_damp, 'data_time_response_damped.csv');
fprintf('    Saved: data_time_response_damped.csv\n');

%% 3. 工况矩阵汇总
if ~isempty(case_results)
    n_cases = length(case_results);
    ids = zeros(n_cases,1); spd = ids; thk = ids; ang = ids;
    ma = ids; md = ids; ms = ids; ra = ids; del = ids; jv = ids;
    for k = 1:n_cases
        r = case_results(k);
        ids(k) = r.case_id; spd(k) = r.speed;
        thk(k) = r.thickness; ang(k) = r.angle;
        ma(k) = r.max_acc; md(k) = r.max_disp;
        ms(k) = r.max_stress; ra(k) = r.rms_acc;
        del(k) = r.DEL; jv(k) = r.J;
    end
    T_cases = table(ids, spd, thk, ang, ma, md, ms, ra, del, jv, ...
        'VariableNames', {'CaseID','Speed_ms','Thickness_m','Angle_deg', ...
        'MaxAcc_ms2','MaxDisp_m','MaxStress_Pa','RMS_Acc_ms2','DEL_Pa','J'});
    writetable(T_cases, 'data_workload_matrix.csv');
    fprintf('    Saved: data_workload_matrix.csv\n');
end

%% 4. 优化结果
n_opt = length(opt_history);
X_opt = vertcat(opt_history.x);
J_opt = [opt_history.J]';
T_opt = table((1:n_opt)', X_opt(:,1), X_opt(:,2), X_opt(:,3), X_opt(:,4), J_opt, ...
    'VariableNames', {'EvalNum','t_d_m','E_d_Pa','eta_d','Omega','J_value'});
writetable(T_opt, 'data_optimization_history.csv');
fprintf('    Saved: data_optimization_history.csv\n');

%% 5. PSD 数据
T_psd = table(res_base.f_psd, res_base.Pxx, ...
    'VariableNames', {'Frequency_Hz','PSD_Acc_Baseline'});
writetable(T_psd, 'data_psd_baseline.csv');
fprintf('    Saved: data_psd_baseline.csv\n');

%% 6. 模态参数
mode_num = (1:params.n_modes)';
T_modal = table(mode_num, params.fn_base(1:params.n_modes)', ...
    params.zeta_base(1:params.n_modes)', res_damp.fn', res_damp.zeta', ...
    params.m_modal(1:params.n_modes)', params.stress_coeff(1:params.n_modes)', ...
    'VariableNames', {'Mode','fn_base_Hz','zeta_base','fn_damped_Hz', ...
    'zeta_damped','ModalMass_kg','StressCoeff_Pa_m'});
writetable(T_modal, 'data_modal_parameters.csv');
fprintf('    Saved: data_modal_parameters.csv\n');

%% 7. 保存完整工作区
save('simulation_workspace.mat');
fprintf('    Saved: simulation_workspace.mat\n');

%% 8. 最优参数汇总
fid = fopen('optimal_design_summary.txt', 'w');
fprintf(fid, '=== 阻尼强化层最优设计参数 ===\n\n');
fprintf(fid, '阻尼层厚度 t_d     = %.2f mm\n', opt_theta.t_d*1000);
fprintf(fid, '阻尼层模量 E_d     = %.2e Pa\n', opt_theta.E_d);
fprintf(fid, '损耗因子   eta_d   = %.4f\n', opt_theta.eta_d);
fprintf(fid, '覆盖率     Omega   = %.4f\n\n', opt_theta.Omega);
fprintf(fid, '=== 性能对比 ===\n');
fprintf(fid, '指标          基准        优化后      降幅\n');
fprintf(fid, 'max|a| (m/s²) %10.1f  %10.1f  %5.1f%%\n', ...
    res_base.max_acc, res_damp.max_acc, (1-res_damp.max_acc/res_base.max_acc)*100);
fprintf(fid, 'max|σ| (MPa)  %10.1f  %10.1f  %5.1f%%\n', ...
    res_base.max_stress/1e6, res_damp.max_stress/1e6, ...
    (1-res_damp.max_stress/res_base.max_stress)*100);
fprintf(fid, 'RMS(a) (m/s²) %10.1f  %10.1f  %5.1f%%\n', ...
    res_base.rms_acc, res_damp.rms_acc, (1-res_damp.rms_acc/res_base.rms_acc)*100);
fprintf(fid, 'DEL    (MPa)  %10.1f  %10.1f  %5.1f%%\n', ...
    res_base.DEL/1e6, res_damp.DEL/1e6, (1-res_damp.DEL/res_base.DEL)*100);
fprintf(fid, 'J(θ)          %10.4f  %10.4f  %5.1f%%\n', ...
    res_base.J, res_damp.J, (1-res_damp.J/res_base.J)*100);
fclose(fid);
fprintf('    Saved: optimal_design_summary.txt\n');

end
