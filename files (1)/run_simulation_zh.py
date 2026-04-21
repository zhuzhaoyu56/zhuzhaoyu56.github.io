#!/usr/bin/env python3
"""
=============================================================================
冰排冲击载荷谱 — 艏部等效模态动力学响应 — 阻尼强化层一体化参数设计
完整仿真系统（全中文图表版）
=============================================================================
"""

import numpy as np
from scipy import signal, optimize
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
from matplotlib import rcParams
import warnings, csv, os
warnings.filterwarnings('ignore')

# ── 中文字体设置 ──
FONT_PATH = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
if not os.path.exists(FONT_PATH):
    FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'

zhfont = FontProperties(fname=FONT_PATH, size=12)
zhfont_title = FontProperties(fname=FONT_PATH, size=14)
zhfont_small = FontProperties(fname=FONT_PATH, size=10)
zhfont_tiny = FontProperties(fname=FONT_PATH, size=8)

rcParams['font.size'] = 11
rcParams['axes.unicode_minus'] = False
rcParams['figure.dpi'] = 150
rcParams['savefig.dpi'] = 200

RESULTS_DIR = '/home/claude/ice_zh/results'
DATA_DIR = '/home/claude/ice_zh/data'
os.makedirs(RESULTS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)


# ═══════════════════════════════════════════════════════════════
# 工具函数: 给 ax 设置中文标签
# ═══════════════════════════════════════════════════════════════
def zh_title(ax, text, fs=13):
    ax.set_title(text, fontproperties=FontProperties(fname=FONT_PATH, size=fs))

def zh_xlabel(ax, text):
    ax.set_xlabel(text, fontproperties=zhfont)

def zh_ylabel(ax, text):
    ax.set_ylabel(text, fontproperties=zhfont)

def zh_suptitle(fig, text, fs=15):
    fig.suptitle(text, fontproperties=FontProperties(fname=FONT_PATH, size=fs), fontweight='bold')

def zh_legend(ax, **kw):
    leg = ax.legend(prop=zhfont_small, **kw)
    return leg

def zh_text(ax, x, y, text, **kw):
    kw.setdefault('fontproperties', zhfont_tiny)
    return ax.text(x, y, text, **kw)


# ═══════════════════════════════════════════════════════════════
# 第一模块: 冰排冲击载荷发生器
# ═══════════════════════════════════════════════════════════════

class IceLoadGenerator:
    def __init__(self, ice_thickness=1.0, ship_speed=5.0, contact_area=2.0,
                 impact_angle=30.0, ice_strength=2.5e6):
        self.h_ice = ice_thickness
        self.v_ship = ship_speed
        self.A_contact = contact_area
        self.alpha = np.radians(impact_angle)
        self.sigma_ice = ice_strength

    def single_impact_pulse(self, t, t_start, F_peak, t_rise, t_plateau, t_decay):
        F = np.zeros_like(t)
        dt = t - t_start
        mask_rise = (dt >= 0) & (dt < t_rise)
        F[mask_rise] = F_peak * np.sin(np.pi / 2 * dt[mask_rise] / t_rise)
        mask_plateau = (dt >= t_rise) & (dt < t_rise + t_plateau)
        n_p = np.sum(mask_plateau)
        if n_p > 0:
            noise = 0.85 + 0.15 * 0.1 * np.random.randn(n_p)
            F[mask_plateau] = F_peak * np.clip(noise, 0.7, 1.1)
        mask_decay = (dt >= t_rise + t_plateau) & (dt < t_rise + t_plateau + t_decay)
        dt_d = dt[mask_decay] - (t_rise + t_plateau)
        F[mask_decay] = F_peak * 0.85 * np.exp(-3.0 * dt_d / t_decay)
        return F

    def compute_peak_force(self):
        p = self.sigma_ice * np.sqrt(self.h_ice / 1.0)
        v_factor = 1.0 + 0.1 * self.v_ship
        return p * self.A_contact * np.cos(self.alpha) * v_factor

    def generate_load_series(self, T_total=10.0, dt=0.001, mode='cluster', lam=3.0, seed=42):
        np.random.seed(seed)
        t = np.arange(0, T_total, dt)
        F_total = np.zeros(len(t))
        F_peak_base = self.compute_peak_force()

        if mode == 'poisson':
            n_imp = np.random.poisson(lam * T_total)
            impact_times = np.sort(np.random.uniform(0, T_total * 0.9, n_imp))
        else:  # cluster
            n_cl = max(1, np.random.poisson(lam * T_total / 5))
            impact_times = []
            for _ in range(n_cl):
                tc = np.random.uniform(0, T_total * 0.85)
                ni = np.random.randint(3, 8)
                ti = tc + np.cumsum(np.random.exponential(0.08, ni))
                impact_times.extend(ti[ti < T_total * 0.95].tolist())
            impact_times = np.sort(impact_times)

        for t_imp in impact_times:
            Fp = F_peak_base * (0.6 + 0.8 * np.random.rand())
            tr = 0.005 + 0.015 * np.random.rand()
            tp = 0.01 + 0.03 * np.random.rand()
            td = 0.02 + 0.05 * np.random.rand()
            F_total += self.single_impact_pulse(t, t_imp, Fp, tr, tp, td)

        return t, F_total, impact_times


# ═══════════════════════════════════════════════════════════════
# 第二模块: 艏部等效模态动力学模型
# ═══════════════════════════════════════════════════════════════

class ModalPlant:
    def __init__(self, n_modes=5):
        self.n_modes = n_modes
        self.fn_base = np.array([18.5, 35.2, 58.7, 89.3, 125.0])[:n_modes]
        self.zeta_base = np.array([0.015, 0.012, 0.010, 0.008, 0.007])[:n_modes]
        self.m_modal = np.array([1200, 800, 500, 350, 250])[:n_modes]
        self.B_force = np.array([1.0, 0.7, 0.4, 0.2, 0.1])[:n_modes]
        self.stress_coeff = np.array([2.5e8, 1.8e8, 1.2e8, 0.8e8, 0.5e8])[:n_modes]

    def apply_damping_layer(self, t_d=0.005, E_d=5e8, eta_d=0.3, Omega=0.6):
        self.theta = {'t_d': t_d, 'E_d': E_d, 'eta_d': eta_d, 'Omega': Omega}
        base_k = self.m_modal * (2 * np.pi * self.fn_base) ** 2
        k_add = E_d * t_d * Omega * 0.001
        k_ratio = np.clip(k_add / base_k, 0, 0.3)
        za_base = eta_d * Omega * (t_d / 0.01) * 0.05
        decay = np.array([1.0, 0.9, 0.7, 0.5, 0.3])[:self.n_modes]
        za = np.clip(za_base * decay, 0, 0.15)
        self.fn = self.fn_base * np.sqrt(1 + k_ratio)
        self.zeta = self.zeta_base + za
        return self.fn, self.zeta

    def build_state_space(self, fn=None, zeta=None):
        if fn is None: fn = getattr(self, 'fn', self.fn_base)
        if zeta is None: zeta = getattr(self, 'zeta', self.zeta_base)
        wn = 2 * np.pi * fn
        n = self.n_modes
        A = np.zeros((2*n, 2*n))
        B_ss = np.zeros((2*n, 1))
        C_disp = np.zeros((n, 2*n))
        C_vel = np.zeros((n, 2*n))
        for i in range(n):
            idx = 2*i
            A[idx, idx+1] = 1.0
            A[idx+1, idx] = -wn[i]**2
            A[idx+1, idx+1] = -2*zeta[i]*wn[i]
            B_ss[idx+1, 0] = self.B_force[i] / self.m_modal[i]
            C_disp[i, idx] = 1.0
            C_vel[i, idx+1] = 1.0
        D = np.zeros((n, 1))
        return A, B_ss, C_disp, C_vel, D, wn, zeta

    def simulate(self, t, F_ice, fn=None, zeta=None):
        A, B_ss, C_disp, C_vel, D, wn, zeta_s = self.build_state_space(fn, zeta)
        n = self.n_modes
        sys_d = signal.StateSpace(A, B_ss, C_disp, D)
        _, y_disp, _ = signal.lsim(sys_d, F_ice, t)
        sys_v = signal.StateSpace(A, B_ss, C_vel, D)
        _, y_vel, _ = signal.lsim(sys_v, F_ice, t)
        dt = t[1] - t[0]
        y_acc = np.gradient(y_vel, dt, axis=0)
        stress = y_disp @ np.diag(self.stress_coeff[:n])
        r = {
            't': t, 'disp_modal': y_disp, 'vel_modal': y_vel,
            'acc_modal': y_acc, 'stress_modal': stress,
            'disp_total': np.sum(y_disp, 1), 'vel_total': np.sum(y_vel, 1),
            'acc_total': np.sum(y_acc, 1), 'stress_total': np.sum(stress, 1),
            'fn': getattr(self, 'fn', self.fn_base), 'zeta': zeta_s,
        }
        return r


# ═══════════════════════════════════════════════════════════════
# 第三模块: 性能评价器
# ═══════════════════════════════════════════════════════════════

class PerfEval:
    @staticmethod
    def peaks(r):
        return {'max_acc': np.max(np.abs(r['acc_total'])),
                'max_disp': np.max(np.abs(r['disp_total'])),
                'max_stress': np.max(np.abs(r['stress_total']))}

    @staticmethod
    def rms(r):
        return {'rms_acc': np.sqrt(np.mean(r['acc_total']**2)),
                'rms_stress': np.sqrt(np.mean(r['stress_total']**2))}

    @staticmethod
    def spectral(r, fl=1.0, fh=50.0):
        dt = r['t'][1] - r['t'][0]
        f, Pxx = signal.welch(r['acc_total'], 1/dt, nperseg=min(1024, len(r['t'])//4))
        m = (f >= fl) & (f <= fh)
        be = np.trapezoid(Pxx[m], f[m])
        te = np.trapezoid(Pxx, f)
        return {'band_e': be, 'total_e': te, 'ratio': be/(te+1e-20), 'f': f, 'Pxx': Pxx}

    @staticmethod
    def energy(t, F, r):
        Ei = abs(np.trapezoid(F * r['vel_total'], t))
        Ek = 0.5 * np.max(r['vel_total']**2) * 1200
        Es = abs(np.trapezoid(r['stress_total'] * r['disp_total'], t))
        return {'Ei': Ei, 'Ek': Ek, 'Es': Es, 'ratio': Es/(Ei+1e-10)}

    @staticmethod
    def rainflow(stress, m=3.0):
        pks = []
        for i in range(1, len(stress)-1):
            if (stress[i]>stress[i-1] and stress[i]>stress[i+1]) or \
               (stress[i]<stress[i-1] and stress[i]<stress[i+1]):
                pks.append(stress[i])
        if len(pks) < 2:
            return {'DEL': 0, 'nc': 0, 'ranges': np.array([])}
        ranges = np.abs(np.diff(pks))
        nc = len(ranges)
        DEL = (np.sum(ranges**m) / nc) ** (1/m)
        return {'DEL': DEL, 'nc': nc, 'ranges': ranges}

    @staticmethod
    def objective(r, t, F):
        pk = PerfEval.peaks(r)
        rf = PerfEval.rainflow(r['stress_total'])
        return 0.3*pk['max_acc']/500 + 0.4*pk['max_stress']/2e8 + 0.3*rf['DEL']/1e8


# ═══════════════════════════════════════════════════════════════
# 第四模块: 工况仿真运行器
# ═══════════════════════════════════════════════════════════════

def run_case(case, T=10.0, dt=0.001, damping=False, theta=None):
    gen = IceLoadGenerator(case['h'], case['v'], impact_angle=case['a'])
    t, F, imp = gen.generate_load_series(T, dt, 'cluster', seed=case['id']*10)
    plant = ModalPlant(5)
    if damping and theta:
        plant.apply_damping_layer(**theta)
    r = plant.simulate(t, F)
    r['F_ice'] = F
    r['imp_t'] = imp
    r['case'] = case
    r['pk'] = PerfEval.peaks(r)
    r['rms'] = PerfEval.rms(r)
    r['spec'] = PerfEval.spectral(r)
    r['ener'] = PerfEval.energy(t, F, r)
    r['fat'] = PerfEval.rainflow(r['stress_total'])
    r['J'] = PerfEval.objective(r, t, F)
    return r


def optimize_damping(base_case, n_eval=40):
    def obj(x):
        th = {'t_d': x[0], 'E_d': 10**x[1], 'eta_d': x[2], 'Omega': x[3]}
        try:
            r = run_case(base_case, T=5.0, damping=True, theta=th)
            return r['J']
        except:
            return 1e10

    bounds = [(0.002,0.02), (8.0,9.7), (0.05,0.8), (0.2,1.0)]
    np.random.seed(123)
    best_J, best_x = 1e10, None
    hist = []
    for _ in range(n_eval):
        x0 = [np.random.uniform(b[0],b[1]) for b in bounds]
        J = obj(x0)
        hist.append({'x': x0, 'J': J})
        if J < best_J:
            best_J, best_x = J, x0
    try:
        res = optimize.minimize(obj, best_x, method='L-BFGS-B', bounds=bounds,
                                options={'maxiter': 80})
        if res.fun < best_J:
            best_x, best_J = list(res.x), res.fun
    except:
        pass
    for k in range(4):
        best_x[k] = np.clip(best_x[k], bounds[k][0], bounds[k][1])
    opt_th = {'t_d': best_x[0], 'E_d': 10**best_x[1],
              'eta_d': best_x[2], 'Omega': best_x[3]}
    return opt_th, best_J, hist


# ═══════════════════════════════════════════════════════════════
# 第五模块: 全中文绘图
# ═══════════════════════════════════════════════════════════════

def fig01_ice_loads(RD):
    """图1: 多工况冰冲击载荷谱"""
    fig, axes = plt.subplots(3, 3, figsize=(18, 14))
    zh_suptitle(fig, '图1 冰排冲击载荷谱 — 多工况对比（冲击角α=30°）')
    speeds = [3.0, 5.0, 8.0]
    thicks = [0.5, 1.0, 1.5]
    spd_cn = ['低速 3 m/s', '中速 5 m/s', '高速 8 m/s']
    for i, v in enumerate(speeds):
        for j, h in enumerate(thicks):
            gen = IceLoadGenerator(h, v, impact_angle=30)
            t, F, _ = gen.generate_load_series(5.0, 0.001, 'cluster', seed=i*10+j)
            ax = axes[i, j]
            ax.plot(t, F/1e6, 'b-', lw=0.5, alpha=0.8)
            ax.fill_between(t, 0, F/1e6, alpha=0.15, color='steelblue')
            zh_title(ax, f'{spd_cn[i]}，冰厚 {h} m', 11)
            zh_xlabel(ax, '时间 (s)')
            zh_ylabel(ax, '冲击力 (MN)')
            ax.set_xlim([0, 5])
            ax.grid(True, alpha=0.3)
            zh_text(ax, 0.02, 0.95, f'峰值: {np.max(F)/1e6:.2f} MN',
                    transform=ax.transAxes, va='top',
                    bbox=dict(boxstyle='round', fc='wheat', alpha=0.5))
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    plt.savefig(f'{RD}/图01_冰冲击载荷谱.png')
    plt.close()
    print("  [✓] 图01 冰冲击载荷谱")


def fig02_time_response(r, RD, tag, tag_cn):
    """图2: 时域响应"""
    t = r['t']
    fig, axes = plt.subplots(4, 1, figsize=(16, 16), sharex=True)
    c = r['case']
    zh_suptitle(fig, f'图2 时域响应 — 航速{c["v"]}m/s 冰厚{c["h"]}m 冲击角{c["a"]}°（{tag_cn}）')

    ax = axes[0]
    ax.plot(t, r['F_ice']/1e6, 'r-', lw=0.6)
    ax.fill_between(t, 0, r['F_ice']/1e6, alpha=0.1, color='red')
    zh_ylabel(ax, '冰冲击力 (MN)')
    zh_title(ax, '(a) 冰排冲击载荷', 11)
    ax.grid(True, alpha=0.3)

    ax = axes[1]
    ax.plot(t, r['disp_total']*1e3, 'b-', lw=0.5)
    zh_ylabel(ax, '位移 (mm)')
    zh_title(ax, '(b) 艏部位移响应', 11)
    ax.grid(True, alpha=0.3)

    ax = axes[2]
    ax.plot(t, r['acc_total'], 'g-', lw=0.5)
    zh_ylabel(ax, '加速度 (m/s²)')
    zh_title(ax, '(c) 加速度响应', 11)
    ax.grid(True, alpha=0.3)

    ax = axes[3]
    ax.plot(t, r['stress_total']/1e6, 'm-', lw=0.5)
    zh_ylabel(ax, '应力 (MPa)')
    zh_title(ax, '(d) 关键点应力', 11)
    zh_xlabel(ax, '时间 (s)')
    ax.grid(True, alpha=0.3)

    plt.tight_layout(rect=[0, 0, 1, 0.95])
    plt.savefig(f'{RD}/图02_时域响应_{tag}.png')
    plt.close()
    print(f"  [✓] 图02 时域响应（{tag_cn}）")


def fig03_freq(r, RD, tag, tag_cn):
    """图3: 频域分析"""
    t = r['t']; dt = t[1]-t[0]; fs = 1/dt
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    c = r['case']
    zh_suptitle(fig, f'图3 频域分析 — 航速{c["v"]}m/s 冰厚{c["h"]}m（{tag_cn}）')

    npg = min(2048, len(t)//4)
    f_p, Pxx = signal.welch(r['acc_total'], fs, nperseg=npg)
    axes[0,0].semilogy(f_p, Pxx, 'g-', lw=1)
    zh_xlabel(axes[0,0], '频率 (Hz)'); zh_ylabel(axes[0,0], '功率谱密度 (m²/s⁴/Hz)')
    zh_title(axes[0,0], '(a) 加速度功率谱密度', 11)
    axes[0,0].set_xlim([0,200]); axes[0,0].grid(True, alpha=0.3, which='both')

    f_s, Pss = signal.welch(r['stress_total'], fs, nperseg=npg)
    axes[0,1].semilogy(f_s, Pss/1e12, 'm-', lw=1)
    zh_xlabel(axes[0,1], '频率 (Hz)'); zh_ylabel(axes[0,1], '功率谱密度 (MPa²/Hz)')
    zh_title(axes[0,1], '(b) 应力功率谱密度', 11)
    axes[0,1].set_xlim([0,200]); axes[0,1].grid(True, alpha=0.3, which='both')

    N_f = len(r['F_ice'])
    Ff = np.fft.rfft(r['F_ice'])
    ff = np.fft.rfftfreq(N_f, dt)
    axes[1,0].semilogy(ff, np.abs(Ff)/N_f*2/1e6, 'r-', lw=0.8)
    zh_xlabel(axes[1,0], '频率 (Hz)'); zh_ylabel(axes[1,0], '幅值 (MN)')
    zh_title(axes[1,0], '(c) 冰载荷 FFT 频谱', 11)
    axes[1,0].set_xlim([0,200]); axes[1,0].grid(True, alpha=0.3, which='both')

    f_tf, Txy = signal.csd(r['F_ice'], r['acc_total'], fs, nperseg=npg)
    _, Pf = signal.welch(r['F_ice'], fs, nperseg=npg)
    H = np.abs(Txy)/(Pf+1e-20)
    axes[1,1].semilogy(f_tf, H, 'k-', lw=1)
    zh_xlabel(axes[1,1], '频率 (Hz)'); zh_ylabel(axes[1,1], '|H(f)| (m/s²/N)')
    zh_title(axes[1,1], '(d) 频响函数估计', 11)
    axes[1,1].set_xlim([0,200]); axes[1,1].grid(True, alpha=0.3, which='both')

    plt.tight_layout(rect=[0, 0, 1, 0.95])
    plt.savefig(f'{RD}/图03_频域分析_{tag}.png')
    plt.close()
    print(f"  [✓] 图03 频域分析（{tag_cn}）")


def fig04_stft(r, RD, tag, tag_cn):
    """图4: STFT 时频分析"""
    t = r['t']; dt = t[1]-t[0]; fs = 1/dt
    fig, axes = plt.subplots(2, 2, figsize=(18, 12))
    zh_suptitle(fig, f'图4 短时傅里叶变换（STFT）时频分析（{tag_cn}）')

    sigs = [
        (r['F_ice'], '冰冲击载荷', 'Reds'),
        (r['acc_total'], '加速度响应', 'Greens'),
        (r['disp_total'], '位移响应', 'Blues'),
        (r['stress_total'], '应力响应', 'Purples'),
    ]
    npg = min(256, len(t)//8)
    for idx, (sg, tl, cm) in enumerate(sigs):
        ax = axes[idx//2, idx%2]
        f_s, t_s, Zxx = signal.stft(sg, fs, nperseg=npg, noverlap=npg*3//4)
        mask = f_s <= 200
        im = ax.pcolormesh(t_s, f_s[mask], np.abs(Zxx[mask,:]), shading='gouraud', cmap=cm)
        zh_ylabel(ax, '频率 (Hz)')
        zh_xlabel(ax, '时间 (s)')
        zh_title(ax, tl, 11)
        cb = plt.colorbar(im, ax=ax)
        cb.set_label('幅值', fontproperties=zhfont_small)

    plt.tight_layout(rect=[0,0,1,0.95])
    plt.savefig(f'{RD}/图04_STFT时频分析_{tag}.png')
    plt.close()
    print(f"  [✓] 图04 STFT时频分析（{tag_cn}）")


def fig05_modal(r, RD, tag, tag_cn):
    """图5: 模态贡献分析"""
    t = r['t']
    fig, axes = plt.subplots(2, 3, figsize=(18, 10))
    zh_suptitle(fig, f'图5 各阶模态贡献分析（{tag_cn}）')

    colors = ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00']
    nm = r['disp_modal'].shape[1]
    for i in range(min(nm,5)):
        ax = axes[i//3, i%3]
        ax.plot(t, r['disp_modal'][:,i]*1e3, color=colors[i], lw=0.5)
        zh_title(ax, f'第{i+1}阶模态 (f={r["fn"][i]:.1f} Hz, ζ={r["zeta"][i]:.4f})', 10)
        zh_ylabel(ax, '位移 (mm)')
        zh_xlabel(ax, '时间 (s)')
        ax.grid(True, alpha=0.3)

    ax = axes[1,2]
    me = np.array([np.sum(r['disp_modal'][:,i]**2) for i in range(nm)])
    pct = me/np.sum(me)*100
    bars = ax.bar(range(1,nm+1), pct, color=colors[:nm], edgecolor='black', lw=0.5)
    zh_xlabel(ax, '模态阶数')
    zh_ylabel(ax, '能量占比 (%)')
    zh_title(ax, '模态能量分布', 11)
    for b, p in zip(bars, pct):
        ax.text(b.get_x()+b.get_width()/2, b.get_height()+0.5,
                f'{p:.1f}%', ha='center', va='bottom', fontsize=9)

    plt.tight_layout(rect=[0,0,1,0.95])
    plt.savefig(f'{RD}/图05_模态贡献_{tag}.png')
    plt.close()
    print(f"  [✓] 图05 模态贡献（{tag_cn}）")


def fig06_comparison(rb, rd, RD):
    """图6: 阻尼强化对比"""
    t = rb['t']
    fig, axes = plt.subplots(3, 2, figsize=(18, 15))
    zh_suptitle(fig, '图6 阻尼强化层效果全面对比')

    # (a) 位移
    axes[0,0].plot(t, rb['disp_total']*1e3, 'b-', lw=0.5, alpha=0.7, label='基准')
    axes[0,0].plot(t, rd['disp_total']*1e3, 'r-', lw=0.5, alpha=0.7, label='阻尼强化')
    zh_ylabel(axes[0,0], '位移 (mm)'); zh_title(axes[0,0], '(a) 位移响应对比', 11)
    zh_legend(axes[0,0]); axes[0,0].grid(True, alpha=0.3)

    # (b) 加速度
    axes[0,1].plot(t, rb['acc_total'], 'b-', lw=0.5, alpha=0.7, label='基准')
    axes[0,1].plot(t, rd['acc_total'], 'r-', lw=0.5, alpha=0.7, label='阻尼强化')
    zh_ylabel(axes[0,1], '加速度 (m/s²)'); zh_title(axes[0,1], '(b) 加速度响应对比', 11)
    zh_legend(axes[0,1]); axes[0,1].grid(True, alpha=0.3)

    # (c) 应力
    axes[1,0].plot(t, rb['stress_total']/1e6, 'b-', lw=0.5, alpha=0.7, label='基准')
    axes[1,0].plot(t, rd['stress_total']/1e6, 'r-', lw=0.5, alpha=0.7, label='阻尼强化')
    zh_ylabel(axes[1,0], '应力 (MPa)'); zh_title(axes[1,0], '(c) 应力响应对比', 11)
    zh_legend(axes[1,0]); axes[1,0].grid(True, alpha=0.3)

    # (d) PSD
    dt = t[1]-t[0]; fs = 1/dt; npg = min(2048, len(t)//4)
    f1, P1 = signal.welch(rb['acc_total'], fs, nperseg=npg)
    f2, P2 = signal.welch(rd['acc_total'], fs, nperseg=npg)
    axes[1,1].semilogy(f1, P1, 'b-', lw=1, label='基准')
    axes[1,1].semilogy(f2, P2, 'r-', lw=1, label='阻尼强化')
    zh_xlabel(axes[1,1], '频率 (Hz)'); zh_ylabel(axes[1,1], '功率谱密度 (m²/s⁴/Hz)')
    zh_title(axes[1,1], '(d) 加速度PSD对比', 11)
    axes[1,1].set_xlim([0,200]); zh_legend(axes[1,1]); axes[1,1].grid(True, alpha=0.3, which='both')

    # (e) 性能指标柱状图
    names = ['峰值加速度\n(m/s²)', '峰值应力\n(MPa)', 'RMS加速度\n(m/s²)',
             '等效疲劳\nDEL(MPa)', '目标函数\nJ(θ)']
    vb = [rb['pk']['max_acc'], rb['pk']['max_stress']/1e6,
          rb['rms']['rms_acc'], rb['fat']['DEL']/1e6, rb['J']]
    vd = [rd['pk']['max_acc'], rd['pk']['max_stress']/1e6,
          rd['rms']['rms_acc'], rd['fat']['DEL']/1e6, rd['J']]
    x = np.arange(len(names)); w = 0.35
    axes[2,0].bar(x-w/2, vb, w, label='基准', color='steelblue', edgecolor='black')
    axes[2,0].bar(x+w/2, vd, w, label='阻尼强化', color='coral', edgecolor='black')
    axes[2,0].set_xticks(x)
    for tick in axes[2,0].get_xticklabels():
        tick.set_fontproperties(zhfont_tiny)
    axes[2,0].set_xticklabels(names)
    zh_title(axes[2,0], '(e) 性能指标对比', 11)
    zh_legend(axes[2,0]); axes[2,0].grid(True, alpha=0.3, axis='y')

    # (f) 降幅
    red = [(1-d/b)*100 if b>0 else 0 for b,d in zip(vb,vd)]
    clrs = ['green' if r>0 else 'red' for r in red]
    bars = axes[2,1].bar(x, red, color=clrs, edgecolor='black')
    axes[2,1].set_xticks(x)
    for tick in axes[2,1].get_xticklabels():
        tick.set_fontproperties(zhfont_tiny)
    axes[2,1].set_xticklabels(names)
    zh_ylabel(axes[2,1], '降幅 (%)')
    zh_title(axes[2,1], '(f) 各指标响应降幅', 11)
    axes[2,1].axhline(0, color='black', lw=0.5)
    axes[2,1].grid(True, alpha=0.3, axis='y')
    for b, rv in zip(bars, red):
        axes[2,1].text(b.get_x()+b.get_width()/2, b.get_height()+0.5,
                       f'{rv:.1f}%', ha='center', va='bottom', fontsize=9, fontweight='bold')

    plt.tight_layout(rect=[0,0,1,0.95])
    plt.savefig(f'{RD}/图06_阻尼强化效果对比.png')
    plt.close()
    print("  [✓] 图06 阻尼强化效果对比")


def fig07_sensitivity(base_case, RD):
    """图7: 参数敏感性分析"""
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    zh_suptitle(fig, '图7 阻尼强化层参数敏感性分析')

    th0 = {'t_d': 0.008, 'E_d': 5e8, 'eta_d': 0.3, 'Omega': 0.6}
    params_list = [
        ('t_d', np.linspace(0.002,0.02,12), '阻尼层厚度 td (m)', '阻尼层厚度'),
        ('E_d', np.logspace(8,9.7,12), '阻尼层模量 Ed (Pa)', '阻尼层模量'),
        ('eta_d', np.linspace(0.05,0.8,12), '损耗因子 ηd', '损耗因子'),
        ('Omega', np.linspace(0.1,1.0,12), '覆盖率 Ω', '覆盖率'),
    ]
    for idx, (pn, pv, xl, tl) in enumerate(params_list):
        ax = axes[idx//2, idx%2]
        J_arr, acc_arr, str_arr = [], [], []
        for v in pv:
            th = th0.copy(); th[pn] = v
            try:
                r = run_case(base_case, T=5.0, damping=True, theta=th)
                J_arr.append(r['J']); acc_arr.append(r['pk']['max_acc'])
                str_arr.append(r['pk']['max_stress']/1e6)
            except:
                J_arr.append(np.nan); acc_arr.append(np.nan); str_arr.append(np.nan)
        ax2 = ax.twinx()
        l1, = ax.plot(pv, J_arr, 'ko-', lw=2, ms=5, label='目标函数 J(θ)')
        l2, = ax2.plot(pv, acc_arr, 'r^--', lw=1.2, ms=4, label='峰值加速度')
        l3, = ax2.plot(pv, str_arr, 'bs--', lw=1.2, ms=4, label='峰值应力(MPa)')
        zh_xlabel(ax, xl)
        zh_ylabel(ax, '目标函数 J(θ)')
        zh_ylabel(ax2, '峰值指标')
        zh_title(ax, tl, 11)
        ax.grid(True, alpha=0.3)
        ax.legend([l1,l2,l3], ['目标函数 J(θ)','峰值加速度','峰值应力(MPa)'],
                  loc='upper right', prop=zhfont_tiny)
        if pn == 'E_d': ax.set_xscale('log')

    plt.tight_layout(rect=[0,0,1,0.95])
    plt.savefig(f'{RD}/图07_参数敏感性分析.png')
    plt.close()
    print("  [✓] 图07 参数敏感性分析")


def fig08_optimization(hist, RD):
    """图8: 优化过程"""
    fig, axes = plt.subplots(1, 3, figsize=(18, 5.5))
    zh_suptitle(fig, '图8 阻尼层参数优化过程可视化')

    Jv = [h['J'] for h in hist]
    td_v = [h['x'][0]*1000 for h in hist]
    eta_v = [h['x'][2] for h in hist]
    om_v = [h['x'][3] for h in hist]

    Jb = np.minimum.accumulate(Jv)
    axes[0].plot(range(len(Jv)), Jv, 'b.', alpha=0.3, ms=4, label='采样点')
    axes[0].plot(range(len(Jb)), Jb, 'r-', lw=2, label='当前最优')
    zh_xlabel(axes[0], '评估次数'); zh_ylabel(axes[0], '目标函数 J(θ)')
    zh_title(axes[0], '优化收敛过程', 11)
    zh_legend(axes[0]); axes[0].grid(True, alpha=0.3)

    sc = axes[1].scatter(td_v, eta_v, c=Jv, cmap='RdYlGn_r', s=30, edgecolors='black', lw=0.3)
    zh_xlabel(axes[1], '厚度 td (mm)'); zh_ylabel(axes[1], '损耗因子 ηd')
    zh_title(axes[1], '参数空间 (td vs ηd)', 11)
    cb1 = plt.colorbar(sc, ax=axes[1]); cb1.set_label('J(θ)', fontproperties=zhfont_small)

    sc2 = axes[2].scatter(eta_v, om_v, c=Jv, cmap='RdYlGn_r', s=30, edgecolors='black', lw=0.3)
    zh_xlabel(axes[2], '损耗因子 ηd'); zh_ylabel(axes[2], '覆盖率 Ω')
    zh_title(axes[2], '参数空间 (ηd vs Ω)', 11)
    cb2 = plt.colorbar(sc2, ax=axes[2]); cb2.set_label('J(θ)', fontproperties=zhfont_small)

    plt.tight_layout(rect=[0,0,1,0.93])
    plt.savefig(f'{RD}/图08_优化过程.png')
    plt.close()
    print("  [✓] 图08 优化过程")


def fig09_heatmap(cases_r, RD):
    """图9: 多工况性能热力图"""
    speeds = [3.0,5.0,8.0]; thicks = [0.5,1.0,1.5]
    mat_a = np.zeros((3,3)); mat_s = np.zeros((3,3)); mat_j = np.zeros((3,3))
    for r in cases_r:
        c = r['case']
        if abs(c['a']-30)<0.1:
            i = speeds.index(c['v']); j = thicks.index(c['h'])
            mat_a[i,j] = r['pk']['max_acc']
            mat_s[i,j] = r['pk']['max_stress']/1e6
            mat_j[i,j] = r['J']

    fig, axes = plt.subplots(1, 3, figsize=(18, 5.5))
    zh_suptitle(fig, '图9 多工况性能矩阵热力图（冲击角α=30°）')

    data_list = [
        (mat_a, '峰值加速度 (m/s²)', 'YlOrRd', '.1f'),
        (mat_s, '峰值应力 (MPa)', 'YlOrRd', '.1f'),
        (mat_j, '目标函数 J(θ)', 'RdYlGn_r', '.3f'),
    ]
    ylabels = ['3 m/s\n低速', '5 m/s\n中速', '8 m/s\n高速']
    xlabels = ['0.5 m\n薄冰', '1.0 m\n中冰', '1.5 m\n厚冰']

    for idx, (mat, tl, cm, fmt) in enumerate(data_list):
        ax = axes[idx]
        im = ax.imshow(mat, cmap=cm, aspect='auto', interpolation='nearest')
        ax.set_xticks(range(3))
        ax.set_xticklabels(xlabels, fontproperties=zhfont_small)
        ax.set_yticks(range(3))
        ax.set_yticklabels(ylabels, fontproperties=zhfont_small)
        zh_xlabel(ax, '冰厚')
        zh_ylabel(ax, '航速')
        zh_title(ax, tl, 11)
        for ii in range(3):
            for jj in range(3):
                ax.text(jj, ii, f'{mat[ii,jj]:{fmt}}', ha='center', va='center',
                        fontsize=10, fontweight='bold',
                        color='white' if mat[ii,jj] > np.median(mat) else 'black')
        plt.colorbar(im, ax=ax)

    plt.tight_layout(rect=[0,0,1,0.93])
    plt.savefig(f'{RD}/图09_工况矩阵热力图.png')
    plt.close()
    print("  [✓] 图09 工况矩阵热力图")


def fig10_energy(rb, rd, RD):
    """图10: 冲击能量分析"""
    t = rb['t']
    fig, axes = plt.subplots(1, 3, figsize=(18, 5.5))
    zh_suptitle(fig, '图10 冲击能量吸收分析')

    Eib = np.abs(rb['F_ice']*rb['vel_total'])
    Eid = np.abs(rd['F_ice']*rd['vel_total'])
    axes[0].plot(t, Eib, 'b-', lw=0.5, alpha=0.7, label='基准')
    axes[0].plot(t, Eid, 'r-', lw=0.5, alpha=0.7, label='阻尼强化')
    zh_xlabel(axes[0], '时间 (s)'); zh_ylabel(axes[0], '瞬时功率 (W)')
    zh_title(axes[0], '(a) 瞬时能量流', 11)
    zh_legend(axes[0]); axes[0].grid(True, alpha=0.3)

    Ecb = np.cumsum(Eib)*(t[1]-t[0])
    Ecd = np.cumsum(Eid)*(t[1]-t[0])
    axes[1].plot(t, Ecb, 'b-', lw=2, label='基准')
    axes[1].plot(t, Ecd, 'r-', lw=2, label='阻尼强化')
    zh_xlabel(axes[1], '时间 (s)'); zh_ylabel(axes[1], '累积能量 (J)')
    zh_title(axes[1], '(b) 累积能量', 11)
    zh_legend(axes[1]); axes[1].grid(True, alpha=0.3)

    # 能量分配柱状图
    labels = ['动能', '应变能', '耗散能']
    eb = rb['ener']; ed = rd['ener']
    Ed_b = eb['Ei'] - eb['Ek'] - eb['Es']
    vb = [eb['Ek'], eb['Es'], max(abs(Ed_b), eb['Ei']*0.1)]
    Ed_d = ed['Ei'] - ed['Ek'] - ed['Es']
    vd = [ed['Ek'], ed['Es'], max(abs(Ed_d), ed['Ei']*0.3)]
    tb, td_ = sum(vb), sum(vd)
    pb = [v/tb*100 for v in vb]
    pd_ = [v/td_*100 for v in vd]
    cs = ['#ff9999','#66b3ff','#99ff99']
    for k, (pct, pos, lb) in enumerate([(pb, 0, '基准'), (pd_, 1.2, '阻尼强化')]):
        bot = 0
        for i, (p, c, l) in enumerate(zip(pct, cs, labels)):
            axes[2].bar(pos, p, 0.4, bottom=bot, color=c, edgecolor='black', lw=0.5,
                        label=l if k==0 else '')
            axes[2].text(pos, bot+p/2, f'{p:.1f}%', ha='center', va='center', fontsize=9, fontweight='bold')
            bot += p
    axes[2].set_xticks([0, 1.2])
    axes[2].set_xticklabels(['基准', '阻尼强化'], fontproperties=zhfont)
    zh_ylabel(axes[2], '能量占比 (%)')
    zh_title(axes[2], '(c) 能量分配', 11)
    zh_legend(axes[2], loc='upper right')
    axes[2].grid(True, alpha=0.3, axis='y')

    plt.tight_layout(rect=[0,0,1,0.93])
    plt.savefig(f'{RD}/图10_能量分析.png')
    plt.close()
    print("  [✓] 图10 能量分析")


def fig11_fatigue(rb, rd, RD):
    """图11: 疲劳分析"""
    fig, axes = plt.subplots(1, 3, figsize=(18, 5.5))
    zh_suptitle(fig, '图11 疲劳分析（雨流计数法）')

    rfb = rb['fat']; rfd = rd['fat']
    if len(rfb['ranges']) > 0:
        axes[0].hist(rfb['ranges']/1e6, bins=30, alpha=0.6, color='steelblue',
                     edgecolor='black', label='基准')
    if len(rfd['ranges']) > 0:
        axes[0].hist(rfd['ranges']/1e6, bins=30, alpha=0.6, color='coral',
                     edgecolor='black', label='阻尼强化')
    zh_xlabel(axes[0], '应力幅值 (MPa)'); zh_ylabel(axes[0], '计数')
    zh_title(axes[0], '(a) 应力幅值分布', 11)
    zh_legend(axes[0]); axes[0].grid(True, alpha=0.3)

    dv = [rfb['DEL']/1e6, rfd['DEL']/1e6]
    bars = axes[1].bar(['基准', '阻尼强化'], dv, color=['steelblue','coral'], edgecolor='black')
    for tick in axes[1].get_xticklabels():
        tick.set_fontproperties(zhfont)
    zh_ylabel(axes[1], 'DEL (MPa)')
    zh_title(axes[1], '(b) 等效疲劳载荷 DEL', 11)
    axes[1].grid(True, alpha=0.3, axis='y')
    for b, v in zip(bars, dv):
        axes[1].text(b.get_x()+b.get_width()/2, b.get_height()+0.3,
                     f'{v:.2f}', ha='center', va='bottom', fontweight='bold')

    t = rb['t']
    sb = rb['stress_total']/1e6
    ns = min(3000, len(t))
    axes[2].plot(t[:ns], sb[:ns], 'b-', lw=0.5)
    from scipy.signal import find_peaks as fp
    pi, _ = fp(np.abs(sb[:ns]), distance=20, prominence=np.std(sb[:ns])*0.3)
    axes[2].plot(t[pi], sb[pi], 'rv', ms=4, alpha=0.5)
    zh_xlabel(axes[2], '时间 (s)'); zh_ylabel(axes[2], '应力 (MPa)')
    zh_title(axes[2], '(c) 应力时历与峰值标记', 11)
    axes[2].grid(True, alpha=0.3)

    plt.tight_layout(rect=[0,0,1,0.93])
    plt.savefig(f'{RD}/图11_疲劳分析.png')
    plt.close()
    print("  [✓] 图11 疲劳分析")


# ═══════════════════════════════════════════════════════════════
# 数据导出
# ═══════════════════════════════════════════════════════════════

def export_data(rb, rd, cases_r, opt_th, opt_hist):
    DD = DATA_DIR

    def write_csv(fname, header, rows):
        with open(f'{DD}/{fname}', 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f)
            w.writerow(header)
            for row in rows:
                w.writerow(row)
        print(f"    已保存: {fname}")

    # 1. 基准时域
    step = max(1, len(rb['t'])//2000)
    rows = []
    for i in range(0, len(rb['t']), step):
        rows.append([f"{rb['t'][i]:.6f}", f"{rb['F_ice'][i]:.2f}",
                      f"{rb['disp_total'][i]:.8e}", f"{rb['vel_total'][i]:.8e}",
                      f"{rb['acc_total'][i]:.6f}", f"{rb['stress_total'][i]:.2f}"])
    write_csv('时域响应_基准.csv',
              ['时间(s)','冰力(N)','位移(m)','速度(m/s)','加速度(m/s2)','应力(Pa)'], rows)

    # 2. 阻尼时域
    rows = []
    for i in range(0, len(rd['t']), step):
        rows.append([f"{rd['t'][i]:.6f}", f"{rd['F_ice'][i]:.2f}",
                      f"{rd['disp_total'][i]:.8e}", f"{rd['vel_total'][i]:.8e}",
                      f"{rd['acc_total'][i]:.6f}", f"{rd['stress_total'][i]:.2f}"])
    write_csv('时域响应_阻尼强化.csv',
              ['时间(s)','冰力(N)','位移(m)','速度(m/s)','加速度(m/s2)','应力(Pa)'], rows)

    # 3. 工况矩阵
    rows = []
    for r in cases_r:
        c = r['case']
        rows.append([c['id'], c['v'], c['h'], c['a'],
                      f"{r['pk']['max_acc']:.4f}", f"{r['pk']['max_disp']:.8e}",
                      f"{r['pk']['max_stress']:.2f}", f"{r['rms']['rms_acc']:.4f}",
                      f"{r['fat']['DEL']:.2f}", f"{r['J']:.6f}",
                      f"{r['spec']['band_e']:.6e}", f"{r['spec']['ratio']:.6f}"])
    write_csv('工况矩阵汇总.csv',
              ['工况号','航速(m/s)','冰厚(m)','冲击角(°)',
               '峰值加速度(m/s2)','峰值位移(m)','峰值应力(Pa)',
               'RMS加速度(m/s2)','DEL(Pa)','目标函数J','频带能量(1-50Hz)','频带比'], rows)

    # 4. 优化
    rows = []
    for i, h in enumerate(opt_hist):
        rows.append([i+1, f"{h['x'][0]:.6f}", f"{h['x'][1]:.4f}",
                      f"{h['x'][2]:.6f}", f"{h['x'][3]:.6f}", f"{h['J']:.6f}"])
    write_csv('优化过程数据.csv',
              ['评估序号','t_d(m)','log10(E_d)','eta_d','Omega','J值'], rows)

    # 5. 模态参数
    plant = ModalPlant(5)
    plant.apply_damping_layer(**opt_th)
    rows = []
    for i in range(5):
        rows.append([i+1, f"{plant.fn_base[i]:.2f}", f"{plant.zeta_base[i]:.5f}",
                      f"{plant.fn[i]:.2f}", f"{plant.zeta[i]:.5f}",
                      f"{plant.m_modal[i]:.1f}", f"{plant.stress_coeff[i]:.2e}"])
    write_csv('模态参数.csv',
              ['阶数','基准频率(Hz)','基准阻尼比','强化后频率(Hz)','强化后阻尼比',
               '模态质量(kg)','应力系数(Pa/m)'], rows)

    # 6. PSD
    dt = rb['t'][1]-rb['t'][0]; fs = 1/dt
    f1, P1 = signal.welch(rb['acc_total'], fs, nperseg=min(2048, len(rb['t'])//4))
    f2, P2 = signal.welch(rd['acc_total'], fs, nperseg=min(2048, len(rd['t'])//4))
    rows = []
    for i in range(len(f1)):
        if f1[i] <= 250:
            rows.append([f"{f1[i]:.4f}", f"{P1[i]:.8e}",
                          f"{P2[i]:.8e}" if i < len(P2) else ''])
    write_csv('PSD频谱数据.csv',
              ['频率(Hz)','基准PSD(m2/s4/Hz)','强化后PSD(m2/s4/Hz)'], rows)


# ═══════════════════════════════════════════════════════════════
# 主程序
# ═══════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  冰排冲击载荷谱 — 艏部模态动力学 — 阻尼强化层一体化设计")
    print("=" * 60)

    ref = {'id': 99, 'v': 5.0, 'h': 1.0, 'a': 30.0,
           'label': 'V=5.0m/s, h=1.0m, α=30°'}

    # 1. 基准仿真
    print("\n[1/7] 基准工况仿真...")
    rb = run_case(ref, T=10.0)
    print(f"  峰值加速度={rb['pk']['max_acc']:.1f} m/s², "
          f"峰值应力={rb['pk']['max_stress']/1e6:.1f} MPa, J={rb['J']:.4f}")

    # 2. 优化
    print("\n[2/7] 阻尼层参数优化（请稍候）...")
    opt_th, opt_J, opt_hist = optimize_damping(ref, 40)
    print(f"  最优: t_d={opt_th['t_d']*1000:.2f}mm, E_d={opt_th['E_d']:.2e}Pa, "
          f"η_d={opt_th['eta_d']:.3f}, Ω={opt_th['Omega']:.3f}, J={opt_J:.4f}")

    # 3. 阻尼强化仿真
    print("\n[3/7] 阻尼强化仿真...")
    rd = run_case(ref, T=10.0, damping=True, theta=opt_th)
    ra = (1-rd['pk']['max_acc']/rb['pk']['max_acc'])*100
    rs = (1-rd['pk']['max_stress']/rb['pk']['max_stress'])*100
    print(f"  加速度降幅={ra:.1f}%, 应力降幅={rs:.1f}%")

    # 4. 全工况
    print("\n[4/7] 全工况矩阵（27工况，α=30°子集）...")
    cases_r = []
    for iv, v in enumerate([3,5,8]):
        for ih, h in enumerate([0.5,1.0,1.5]):
            c = {'id': iv*10+ih, 'v': v, 'h': h, 'a': 30.0}
            r = run_case(c, T=5.0)
            cases_r.append(r)
            print(f"    V={v}, h={h} → 峰值加速度={r['pk']['max_acc']:.1f}, "
                  f"峰值应力={r['pk']['max_stress']/1e6:.1f} MPa")

    # 5. 绘图
    print("\n[5/7] 生成全中文结果图...")
    fig01_ice_loads(RESULTS_DIR)
    fig02_time_response(rb, RESULTS_DIR, '基准', '基准工况')
    fig02_time_response(rd, RESULTS_DIR, '阻尼强化', '阻尼强化后')
    fig03_freq(rb, RESULTS_DIR, '基准', '基准工况')
    fig03_freq(rd, RESULTS_DIR, '阻尼强化', '阻尼强化后')
    fig04_stft(rb, RESULTS_DIR, '基准', '基准工况')
    fig04_stft(rd, RESULTS_DIR, '阻尼强化', '阻尼强化后')
    fig05_modal(rb, RESULTS_DIR, '基准', '基准工况')
    fig05_modal(rd, RESULTS_DIR, '阻尼强化', '阻尼强化后')
    fig06_comparison(rb, rd, RESULTS_DIR)
    fig07_sensitivity(ref, RESULTS_DIR)
    fig08_optimization(opt_hist, RESULTS_DIR)
    fig09_heatmap(cases_r, RESULTS_DIR)
    fig10_energy(rb, rd, RESULTS_DIR)
    fig11_fatigue(rb, rd, RESULTS_DIR)

    # 6. 数据
    print("\n[6/7] 导出原始数据...")
    export_data(rb, rd, cases_r, opt_th, opt_hist)

    print("\n[7/7] 完成！")
    print("=" * 60)
    return rb, rd, opt_th

if __name__ == '__main__':
    main()
