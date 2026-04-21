function plot_all_results(t, F_ice, res_base, res_damp, case_results, ...
                          opt_theta, opt_history, params)
%==========================================================================
% plot_all_results.m
% 生成全部结果图 (11 幅图)
%==========================================================================

%% ===== 图1: 冰冲击载荷谱多工况对比 =====
figure('Position', [100 100 1400 1000]);
speeds = [3,5,8]; thicks = [0.5,1.0,1.5];
idx = 0;
for iv = 1:3
    for ih = 1:3
        idx = idx + 1;
        subplot(3,3,idx);
        p = params; p.V_ship = speeds(iv); p.h_ice = thicks(ih); p.T_total=5;
        [tk, Fk, ~] = ice_load_generator(p, 'cluster', iv*10+ih);
        plot(tk, Fk/1e6, 'b-', 'LineWidth', 0.5);
        title(sprintf('V=%d m/s, h=%.1f m', speeds(iv), thicks(ih)));
        xlabel('Time (s)'); ylabel('Force (MN)');
        grid on; xlim([0 5]);
        text(0.02, 0.95, sprintf('Peak: %.2f MN', max(Fk)/1e6), ...
            'Units','normalized','VerticalAlignment','top','FontSize',8);
    end
end
sgtitle('Ice Impact Load Spectrum — Multi-Condition', 'FontWeight','bold');
saveas(gcf, 'fig01_ice_load_spectrum.png');

%% ===== 图2: 基准时域响应 =====
figure('Position', [100 100 1200 1000]);
subplot(4,1,1);
plot(t, F_ice/1e6, 'r-', 'LineWidth', 0.6);
ylabel('Force (MN)'); title('(a) Ice Impact Load'); grid on;

subplot(4,1,2);
plot(t, res_base.disp_total*1e3, 'b-', 'LineWidth', 0.5);
ylabel('Disp (mm)'); title('(b) Displacement'); grid on;

subplot(4,1,3);
plot(t, res_base.acc_total, 'g-', 'LineWidth', 0.5);
ylabel('Acc (m/s²)'); title('(c) Acceleration'); grid on;

subplot(4,1,4);
plot(t, res_base.stress_total/1e6, 'm-', 'LineWidth', 0.5);
ylabel('Stress (MPa)'); title('(d) Critical Point Stress');
xlabel('Time (s)'); grid on;
sgtitle('Baseline Time-Domain Response', 'FontWeight','bold');
saveas(gcf, 'fig02_time_response_baseline.png');

%% ===== 图3: 频域分析 =====
figure('Position', [100 100 1200 900]);
fs = params.fs;

subplot(2,2,1);
[Pxx, f] = pwelch(res_base.acc_total, 2048, [], [], fs);
semilogy(f, Pxx, 'g-', 'LineWidth', 1);
xlabel('Frequency (Hz)'); ylabel('PSD (m²/s⁴/Hz)');
title('(a) Acceleration PSD'); xlim([0 200]); grid on;

subplot(2,2,2);
[Pxx_s, f_s] = pwelch(res_base.stress_total, 2048, [], [], fs);
semilogy(f_s, Pxx_s/1e12, 'm-', 'LineWidth', 1);
xlabel('Frequency (Hz)'); ylabel('PSD (MPa²/Hz)');
title('(b) Stress PSD'); xlim([0 200]); grid on;

subplot(2,2,3);
N_fft = length(F_ice);
F_fft = abs(fft(F_ice)) / N_fft * 2;
f_fft = (0:N_fft-1) * fs / N_fft;
semilogy(f_fft(1:N_fft/2), F_fft(1:N_fft/2)/1e6, 'r-', 'LineWidth', 0.8);
xlabel('Frequency (Hz)'); ylabel('Amplitude (MN)');
title('(c) Ice Load FFT'); xlim([0 200]); grid on;

subplot(2,2,4);
[Txy, f_tf] = cpsd(F_ice, res_base.acc_total, 2048, [], [], fs);
[Pf, ~] = pwelch(F_ice, 2048, [], [], fs);
H = abs(Txy) ./ (Pf + 1e-20);
semilogy(f_tf, H, 'k-', 'LineWidth', 1);
xlabel('Frequency (Hz)'); ylabel('|H(f)|');
title('(d) FRF Estimate'); xlim([0 200]); grid on;
sgtitle('Frequency-Domain Analysis (Baseline)', 'FontWeight','bold');
saveas(gcf, 'fig03_frequency_analysis.png');

%% ===== 图4: STFT 时频分析 =====
figure('Position', [100 100 1400 900]);
signals = {F_ice, res_base.acc_total, res_base.disp_total, res_base.stress_total};
titles_stft = {'Ice Force', 'Acceleration', 'Displacement', 'Stress'};
for k = 1:4
    subplot(2,2,k);
    spectrogram(signals{k}, 256, 192, 256, fs, 'yaxis');
    ylim([0 200]);
    title(titles_stft{k});
    colorbar;
end
sgtitle('STFT Time-Frequency Analysis (Baseline)', 'FontWeight','bold');
saveas(gcf, 'fig04_stft_baseline.png');

%% ===== 图5: 模态贡献 =====
figure('Position', [100 100 1400 700]);
colors = {'r','b','g','m','c'};
n = params.n_modes;
for i = 1:min(n, 5)
    subplot(2,3,i);
    plot(t, res_base.disp_modal(:,i)*1e3, colors{i}, 'LineWidth', 0.5);
    title(sprintf('Mode %d (f=%.1f Hz, ζ=%.4f)', i, res_base.fn(i), res_base.zeta(i)));
    ylabel('Disp (mm)'); xlabel('Time (s)'); grid on;
end
subplot(2,3,6);
modal_energy = sum(res_base.disp_modal.^2, 1);
bar(1:n, modal_energy/sum(modal_energy)*100, 'FaceColor', [0.3 0.6 0.9]);
xlabel('Mode'); ylabel('Energy (%)');
title('Modal Energy Distribution');
sgtitle('Modal Contribution Analysis', 'FontWeight','bold');
saveas(gcf, 'fig05_modal_contributions.png');

%% ===== 图6: 阻尼强化对比 =====
figure('Position', [100 100 1400 1100]);
subplot(3,2,1);
plot(t, res_base.disp_total*1e3, 'b-', t, res_damp.disp_total*1e3, 'r-', 'LineWidth', 0.5);
legend('Baseline','Damped'); ylabel('Disp (mm)'); title('(a) Displacement'); grid on;

subplot(3,2,2);
plot(t, res_base.acc_total, 'b-', t, res_damp.acc_total, 'r-', 'LineWidth', 0.5);
legend('Baseline','Damped'); ylabel('Acc (m/s²)'); title('(b) Acceleration'); grid on;

subplot(3,2,3);
plot(t, res_base.stress_total/1e6, 'b-', t, res_damp.stress_total/1e6, 'r-', 'LineWidth', 0.5);
legend('Baseline','Damped'); ylabel('Stress (MPa)'); title('(c) Stress'); grid on;

subplot(3,2,4);
[P1,f1] = pwelch(res_base.acc_total, 2048, [], [], fs);
[P2,f2] = pwelch(res_damp.acc_total, 2048, [], [], fs);
semilogy(f1, P1, 'b-', f2, P2, 'r-', 'LineWidth', 1);
legend('Baseline','Damped'); xlabel('Hz'); ylabel('PSD');
title('(d) Acceleration PSD'); xlim([0 200]); grid on;

subplot(3,2,5);
metrics = {'max|a|','max|σ|','RMS(a)','DEL','J(θ)'};
vb = [res_base.max_acc, res_base.max_stress/1e6, res_base.rms_acc, res_base.DEL/1e6, res_base.J];
vd = [res_damp.max_acc, res_damp.max_stress/1e6, res_damp.rms_acc, res_damp.DEL/1e6, res_damp.J];
bar([vb; vd]'); legend('Baseline','Damped');
set(gca, 'XTickLabel', metrics); title('(e) Metrics Comparison'); grid on;

subplot(3,2,6);
reductions = (1 - vd./vb)*100;
bar(reductions, 'FaceColor', [0.2 0.7 0.3]);
set(gca, 'XTickLabel', metrics); ylabel('Reduction (%)');
title('(f) Response Reduction'); grid on;
sgtitle('Damping Reinforcement Layer Effect', 'FontWeight','bold');
saveas(gcf, 'fig06_damping_comparison.png');

%% ===== 图7: 敏感性分析 =====
figure('Position', [100 100 1200 900]);
theta_base = struct('t_d',0.008,'E_d',5e8,'eta_d',0.3,'Omega',0.6);
param_names = {'t_d', 'E_d', 'eta_d', 'Omega'};
param_ranges = {linspace(0.002,0.02,12), logspace(8,9.7,12), ...
                linspace(0.05,0.8,12), linspace(0.1,1.0,12)};
xlabels = {'Thickness t_d (m)', 'Modulus E_d (Pa)', ...
           'Loss Factor η_d', 'Coverage Ω'};

for ip = 1:4
    subplot(2,2,ip);
    J_arr = zeros(size(param_ranges{ip}));
    for k = 1:length(param_ranges{ip})
        th = theta_base;
        th.(param_names{ip}) = param_ranges{ip}(k);
        try
            p_short = params; p_short.T_total = 5;
            [ts, Fs, ~] = ice_load_generator(p_short, 'cluster', 99);
            r = modal_plant_simulate(ts, Fs, p_short, th);
            J_arr(k) = r.J;
        catch
            J_arr(k) = NaN;
        end
    end
    plot(param_ranges{ip}, J_arr, 'ko-', 'LineWidth', 2, 'MarkerSize', 5);
    xlabel(xlabels{ip}); ylabel('J(θ)'); grid on;
    title(xlabels{ip});
    if ip == 2, set(gca, 'XScale', 'log'); end
end
sgtitle('Damping Layer Parameter Sensitivity', 'FontWeight','bold');
saveas(gcf, 'fig07_sensitivity.png');

%% ===== 图8: 优化过程 =====
figure('Position', [100 100 1400 400]);
J_hist = [opt_history.J];
subplot(1,3,1);
plot(1:length(J_hist), J_hist, 'b.', 'MarkerSize', 6);
hold on; plot(1:length(J_hist), cummin(J_hist), 'r-', 'LineWidth', 2);
xlabel('Evaluation #'); ylabel('J(θ)');
title('Optimization Convergence'); legend('Samples','Best'); grid on;

subplot(1,3,2);
X_hist = vertcat(opt_history.x);
scatter(X_hist(:,1)*1000, X_hist(:,3), 30, J_hist, 'filled');
xlabel('t_d (mm)'); ylabel('η_d'); colorbar; title('t_d vs η_d'); grid on;

subplot(1,3,3);
scatter(X_hist(:,3), X_hist(:,4), 30, J_hist, 'filled');
xlabel('η_d'); ylabel('Ω'); colorbar; title('η_d vs Ω'); grid on;
sgtitle('Optimization Process', 'FontWeight','bold');
saveas(gcf, 'fig08_optimization.png');

%% ===== 图9: 工况矩阵热力图 =====
if ~isempty(case_results)
    figure('Position', [100 100 1400 400]);
    speeds = [3,5,8]; thicks = [0.5,1.0,1.5];
    mat_acc = zeros(3,3); mat_stress = zeros(3,3);
    for k = 1:length(case_results)
        r = case_results(k);
        iv = find(speeds == r.speed);
        ih = find(thicks == r.thickness);
        if ~isempty(iv) && ~isempty(ih)
            mat_acc(iv, ih) = r.max_acc;
            mat_stress(iv, ih) = r.max_stress/1e6;
        end
    end
    subplot(1,2,1);
    imagesc(mat_acc); colorbar; colormap(hot);
    set(gca, 'XTickLabel', {'0.5m','1.0m','1.5m'}, 'YTickLabel', {'3m/s','5m/s','8m/s'});
    title('Peak Acceleration (m/s²)');
    for ii=1:3, for jj=1:3
        text(jj, ii, sprintf('%.0f', mat_acc(ii,jj)), 'HorizontalAlignment','center', 'FontWeight','bold');
    end, end
    
    subplot(1,2,2);
    imagesc(mat_stress); colorbar; colormap(hot);
    set(gca, 'XTickLabel', {'0.5m','1.0m','1.5m'}, 'YTickLabel', {'3m/s','5m/s','8m/s'});
    title('Peak Stress (MPa)');
    for ii=1:3, for jj=1:3
        text(jj, ii, sprintf('%.0f', mat_stress(ii,jj)), 'HorizontalAlignment','center', 'FontWeight','bold');
    end, end
    sgtitle('Multi-Condition Performance Matrix (α=30°)', 'FontWeight','bold');
    saveas(gcf, 'fig09_workload_matrix.png');
end

%% ===== 图10-11: 能量与疲劳分析 =====
figure('Position', [100 100 1400 500]);
% 累积能量
E_cum_b = cumsum(abs(F_ice .* res_base.vel_total)) * (t(2)-t(1));
E_cum_d = cumsum(abs(F_ice .* res_damp.vel_total)) * (t(2)-t(1));
subplot(1,2,1);
plot(t, E_cum_b, 'b-', t, E_cum_d, 'r-', 'LineWidth', 2);
legend('Baseline','Damped'); xlabel('Time (s)'); ylabel('Energy (J)');
title('Cumulative Energy'); grid on;

% DEL对比
subplot(1,2,2);
bar([res_base.DEL/1e6, res_damp.DEL/1e6], 'FaceColor', [0.3 0.6 0.9]);
set(gca, 'XTickLabel', {'Baseline','Damped'}); ylabel('DEL (MPa)');
title('Damage Equivalent Load'); grid on;
sgtitle('Energy & Fatigue Analysis', 'FontWeight','bold');
saveas(gcf, 'fig10_energy_fatigue.png');

fprintf('  All figures saved.\n');
end

%% ===== 辅助函数 =====
function y = cummin(x)
y = x;
for i = 2:length(x)
    y(i) = min(y(i-1), x(i));
end
end
