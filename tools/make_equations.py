#!/usr/bin/env python3
"""
make_equations.py — typeset every equation, label and word drawn on the
chalkboard with real LaTeX, and save them as compact vector data in
js/data/equations.js. The browser draws them with Path2D (see js/lib/chalk.js):
no images, no web fonts, always sharp.

HOW TO EDIT
  1. Add or change an entry in ITEMS below (id -> LaTeX, math mode).
     Text: wrap it as \text{...}, \textsc{...} (small caps) or \textit{...}.
  2. Run:  python3 tools/make_equations.py
     (needs pdflatex + pdftocairo, e.g. TeX Live + poppler-utils)
  3. Use the id in a scene, e.g.  CH.draw(ctx, "euler", 18, x, y)
"""
import json, os, re, subprocess, sys, tempfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SC = lambda s: r"\text{\textsc{" + s + "}}"   # small caps word
IT = lambda s: r"\text{\textit{" + s + "}}"   # italic word

ITEMS = {
    # ------------------------------------------------------------ population dynamics
    "lv": r"\begin{aligned}\frac{dx}{dt}&=\alpha x-\beta xy\\[2pt]\frac{dy}{dt}&=\delta xy-\gamma y\end{aligned}",
    "lv_inline": r"\dot x=\alpha x-\beta xy,\qquad \dot y=\delta xy-\gamma y",
    "logistic": r"\frac{dN}{dt}=rN\left(1-\frac{N}{K}\right)",
    "comp_lv": r"\begin{aligned}\dot x&=x\,(1-x-a\,y)\\ \dot y&=y\,(1-y-b\,x)\end{aligned}",
    "lanchester": r"\frac{dA}{dt}=-\beta B,\qquad \frac{dB}{dt}=-\alpha A",
    "replicator": r"\dot x_i=x_i\left[(A\mathbf{x})_i-\mathbf{x}^{\top}\!A\mathbf{x}\right]",
    # ------------------------------------------------------------ stochastic
    "fokker_planck": r"\frac{\partial p}{\partial t}=-\frac{\partial}{\partial x}\big[\mu(x,t)\,p\big]+\frac{1}{2}\frac{\partial^{2}}{\partial x^{2}}\big[\sigma^{2}(x,t)\,p\big]",
    "ito": r"dX_t=\mu(X_t,t)\,dt+\sigma(X_t,t)\,dW_t",
    "ito_lemma": r"df(X_t)=\Big(f'\mu+\tfrac{1}{2}f''\sigma^{2}\Big)dt+f'\sigma\,dW_t",
    "ou": r"dX_t=\theta\,(\mu-X_t)\,dt+\sigma\,dW_t",
    "fp_ou": r"\partial_t p=\partial_x\!\big[\theta(x-\mu)\,p\big]+\frac{\sigma^{2}}{2}\,\partial_x^{2}p",
    "random_walk": r"X_{n+1}=X_n+\xi_n,\qquad \langle X_n^{2}\rangle=n\,\sigma^{2}",
    "diffusion": r"\frac{\partial P}{\partial t}=D\,\nabla^{2}P",
    "gauss": r"p(x)=\frac{1}{\sqrt{2\pi\sigma^{2}}}\,e^{-\frac{(x-\mu)^{2}}{2\sigma^{2}}}",
    # ------------------------------------------------------------ stability & predictability (Home)
    "dynsys": r"\dot{\mathbf{x}}=f(\mathbf{x}),\qquad \mathbf{x}(0)=\mathbf{x}_0",
    "lyapunov": r"V(\mathbf{x})>0,\qquad \dot V=\nabla V\cdot f(\mathbf{x})<0",
    "lyap_exp": r"\lambda=\lim_{t\to\infty}\frac{1}{t}\ln\frac{\lVert\delta\mathbf{x}(t)\rVert}{\lVert\delta\mathbf{x}_0\rVert}",
    "predict": r"\lVert\delta\mathbf{x}(t)\rVert\approx\lVert\delta\mathbf{x}_0\rVert\,e^{\lambda t}",
    "pred_time": r"T_{\mathrm{pred}}\approx\frac{1}{\lambda}\,\ln\frac{\Delta}{\lVert\delta\mathbf{x}_0\rVert}",
    "jacobian": r"J=\begin{pmatrix}\alpha-\beta y&-\beta x\\ \delta y&\delta x-\gamma\end{pmatrix}",
    "eigen": r"\det(J-\lambda I)=0\;\Rightarrow\;\lambda=\pm\, i\sqrt{\alpha\gamma}",
    "stable": r"\operatorname{Re}\lambda_i<0\;\Rightarrow\;\text{stable}",
    "basin": r"\mathcal{B}(A)=\{\mathbf{x}_0:\ \phi_t(\mathbf{x}_0)\to A\}",
    "hopf": r"\dot r=\mu r-r^{3},\qquad \dot\theta=\omega",
    "vdot": r"\dot V<0",
    "w_lyapunov": SC("Lyapunov stability"), "w_predict": SC("Predictability"),
    # ------------------------------------------------------------ Fourier / collective behaviour
    "fourier": r"\hat f(\xi)=\int_{-\infty}^{\infty}f(x)\,e^{-2\pi i x\xi}\,dx",
    "fourier_series": r"f(t)=\sum_{n=-\infty}^{\infty}c_n\,e^{\,i n t}",
    "vicsek": r"\theta_i(t+1)=\langle\theta_j\rangle_{|r_i-r_j|<r}+\eta_i",
    "pursuit": r"\dot{\mathbf{x}}_w=v_w\,\frac{\mathbf{x}_h-\mathbf{x}_w}{\lVert\mathbf{x}_h-\mathbf{x}_w\rVert}",
    # ------------------------------------------------------------ Elementary mathematics
    "euler": r"e^{i\pi}+1=0",
    "cauchy": r"f(a)=\frac{1}{2\pi i}\oint_{\gamma}\frac{f(z)}{z-a}\,dz",
    "stokes": r"\int_{\partial\Omega}\omega=\int_{\Omega}d\omega",
    "gauss_bonnet": r"\int_{M}K\,dA+\int_{\partial M}k_g\,ds=2\pi\,\chi(M)",
    "euler_char": r"V-E+F=2",
    "spectral": r"A=U\Lambda U^{*},\qquad U^{*}U=I",
    "eigen_eq": r"A\mathbf{v}=\lambda\mathbf{v}",
    "rank_nullity": r"\dim\ker T+\dim\operatorname{im}T=\dim V",
    "hilbert": r"\langle f,g\rangle=\int f(x)\,\overline{g(x)}\,dx",
    "cauchy_schwarz": r"|\langle u,v\rangle|\le\lVert u\rVert\,\lVert v\rVert",
    "parseval": r"\sum_{n}|c_n|^{2}=\frac{1}{2\pi}\int_{-\pi}^{\pi}|f(t)|^{2}\,dt",
    "basel": r"\sum_{n=1}^{\infty}\frac{1}{n^{2}}=\frac{\pi^{2}}{6}",
    "gauss_int": r"\int_{-\infty}^{\infty}e^{-x^{2}}\,dx=\sqrt{\pi}",
    "cauchy_riemann": r"\frac{\partial u}{\partial x}=\frac{\partial v}{\partial y},\qquad\frac{\partial u}{\partial y}=-\frac{\partial v}{\partial x}",
    "residue": r"\oint_{\gamma}f(z)\,dz=2\pi i\sum_{k}\operatorname{Res}(f,a_k)",
    "ftc": r"\int_{a}^{b}f'(x)\,dx=f(b)-f(a)",
    "lorenz": r"\dot x=\sigma(y-x),\quad \dot y=x(\rho-z)-y,\quad \dot z=xy-\beta z",
    "logistic_map": r"x_{n+1}=r\,x_n(1-x_n)",
    "zeta": r"\zeta(s)=\sum_{n=1}^{\infty}\frac{1}{n^{s}}=\prod_{p}\frac{1}{1-p^{-s}}",
    "pi1": r"\pi_1(S^{1})\cong\mathbb{Z}",
    "golden": r"\varphi=\frac{1+\sqrt{5}}{2}",
    "taylor": r"f(x)=\sum_{n=0}^{\infty}\frac{f^{(n)}(a)}{n!}\,(x-a)^{n}",
    "w_hilbert": SC("Hilbert space"), "w_banach": IT("Banach space"), "w_topology": SC("Topology"),
    "w_homeo": IT("homeomorphism"), "w_linalg": SC("Linear algebra"), "w_eigen": IT("eigenvalues"),
    "w_complex": SC("Complex analysis"), "w_holo": IT("holomorphic"), "w_fourier": SC("Fourier analysis"),
    "w_manifold": IT("manifold"), "w_group": SC("Group theory"), "w_measure": SC("Measure theory"),
    "w_chaos": SC("Chaos"), "w_attractor": IT("strange attractor"), "w_bifurcation": IT("bifurcation"),
    "w_fractal": IT("fractal"), "w_infinity": SC("Infinity"), "w_primes": IT("prime numbers"),
    "w_symmetry": SC("Symmetry"), "w_number": SC("Number theory"), "w_probability": SC("Probability"),
    "w_lorenz": IT("the Lorenz attractor"), "w_logmap": IT("logistic map: period doubling"),
    # ------------------------------------------------------------ Strategic Intelligence Lab
    "kelly": r"f^{*}=p-\frac{q}{b}",
    "bayes": r"P(A\mid B)=\frac{P(B\mid A)\,P(A)}{P(B)}",
    "expect": r"\mathbb{E}[X]=\sum_{x}x\,P(X=x)",
    "nash": r"u_i(s_i^{*},s_{-i}^{*})\ge u_i(s_i,s_{-i}^{*})\quad\forall s_i",
    "minimax": r"\max_{x}\min_{y}\,x^{\top}\!Ay=\min_{y}\max_{x}\,x^{\top}\!Ay",
    "gambler": r"P_i=\frac{1-(q/p)^{i}}{1-(q/p)^{N}}",
    "binomial": r"P(k)=\binom{n}{k}p^{k}(1-p)^{n-k}",
    "variance": r"\operatorname{Var}(X)=\mathbb{E}[X^{2}]-\mathbb{E}[X]^{2}",
    "p_royal": r"P(\text{royal flush})=\frac{4}{\binom{52}{5}}\approx\frac{1}{649\,740}",
    "payoff": r"\begin{array}{c|cc} & C & D\\ \hline C & 3,3 & 0,5\\ D & 5,0 & 1,1\end{array}",
    "l_payoff": SC("Payoff matrix"), "l_nash": IT("Nash equilibrium"), "l_monty": SC("Monty Hall"),
    "l_stay": r"\text{stay}\;\tfrac{1}{3}", "l_switch": r"\text{switch}\;\tfrac{2}{3}",
    "l_dice": IT("sum of two dice"), "l_coin": IT("coin flips: a random walk"), "l_tree": IT("probability tree"),
    "l_goat": IT("goat"), "l_car": IT("car"), "t_p": r"p", "t_q": r"1-p", "t_pp": r"p^{2}", "t_pq": r"p(1-p)",
    "s_sp": r"\spadesuit", "s_he": r"\heartsuit", "s_di": r"\diamondsuit", "s_cl": r"\clubsuit",
    "r_A": r"\mathrm{A}", "r_K": r"\mathrm{K}", "r_Q": r"\mathrm{Q}", "r_J": r"\mathrm{J}", "r_7": r"7", "r_10": r"10",
    "d_1": r"1", "d_2": r"2", "d_3": r"3", "c_H": r"\mathrm{H}", "c_T": r"\mathrm{T}",
    "n_2": r"2", "n_7": r"7", "n_12": r"12",
    # ------------------------------------------------------------ axis / panel captions
    "ax_prey": r"\text{prey }x\text{ (hares)}",
    "ax_pred": r"\text{predators }y\text{ (wolves)}",
    "ax_t": r"t", "ax_xt": r"x(t),\;y(t)", "ax_Xt": r"X_t", "ax_px": r"p(x)", "ax_r": r"r", "ax_x": r"x",
}

NS = {"svg": "http://www.w3.org/2000/svg", "xlink": "http://www.w3.org/1999/xlink"}
PREAMBLE = r"""\documentclass[border=1.5pt]{standalone}
\usepackage{amsmath,amssymb,bm}
\begin{document}
$\displaystyle %s$
\end{document}
"""

def typeset(tex, workdir, name):
    with open(os.path.join(workdir, name + ".tex"), "w") as f:
        f.write(PREAMBLE % tex)
    subprocess.run(["pdflatex", "-interaction=nonstopmode", "-halt-on-error", name + ".tex"],
                   cwd=workdir, check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["pdftocairo", "-svg", name + ".pdf", name + ".svg"], cwd=workdir, check=True)
    return open(os.path.join(workdir, name + ".svg")).read()

NUM = lambda v: float(f"{v:.2f}")
def num_d(d):  # shorten every number in an SVG path to 2 decimals
    return re.sub(r"-?\d+\.\d+", lambda m: f"{float(m.group(0)):.2f}".rstrip("0").rstrip("."), d).strip()

def parse_matrix(tr):
    if not tr: return [1, 0, 0, 1, 0, 0]
    m = re.match(r"matrix\(([^)]*)\)", tr.strip())
    if m: return [float(v) for v in re.split(r"[ ,]+", m.group(1).strip())]
    m = re.match(r"translate\(([^)]*)\)", tr.strip())
    if m:
        v = [float(x) for x in re.split(r"[ ,]+", m.group(1).strip())]
        return [1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0]
    raise ValueError("transform " + tr)

def mul(a, b):
    return [a[0]*b[0] + a[2]*b[1], a[1]*b[0] + a[3]*b[1], a[0]*b[2] + a[2]*b[3], a[1]*b[2] + a[3]*b[3],
            a[0]*b[4] + a[2]*b[5] + a[4], a[1]*b[4] + a[3]*b[5] + a[5]]

def convert(svg_text, glyphs, gidx):
    """SVG from pdftocairo -> {w, h, u: glyph uses, f: filled paths, s: stroked paths}"""
    root = ET.fromstring(svg_text)
    w, h = float(root.get("width").replace("pt", "")), float(root.get("height").replace("pt", ""))
    defs = {}
    for g in root.iter("{%s}g" % NS["svg"]):
        gid = g.get("id")
        if gid and "glyph" in gid:
            defs[gid] = " ".join(p.get("d") for p in g.findall("{%s}path" % NS["svg"]) if p.get("d"))
    uses, fills, strokes = [], [], []
    def walk(node, M):
        tag = node.tag.split("}")[1]
        if tag == "defs": return
        M2 = mul(M, parse_matrix(node.get("transform"))) if node.get("transform") else M
        if tag == "use":
            d = defs.get(node.get("{%s}href" % NS["xlink"])[1:], "")
            if d.strip():
                cd = num_d(d)
                if cd not in gidx: gidx[cd] = len(glyphs); glyphs.append(cd)
                p = mul(M2, [1, 0, 0, 1, float(node.get("x", 0)), float(node.get("y", 0))])
                uses.append([gidx[cd], NUM(p[4]), NUM(p[5])])
        elif tag == "path":
            d = num_d(node.get("d", ""))
            if d:
                if node.get("fill") == "none": strokes.append([d, NUM(float(node.get("stroke-width", 1)))] + [NUM(v) for v in M2])
                else: fills.append([d] + [NUM(v) for v in M2])
        for ch in node: walk(ch, M2)
    for ch in root: walk(ch, [1, 0, 0, 1, 0, 0])
    return {"w": NUM(w), "h": NUM(h), "u": uses, "f": fills, "s": strokes}

def main():
    glyphs, gidx, out = [], {}, {}
    with tempfile.TemporaryDirectory() as td:
        for name, tex in ITEMS.items():
            try:
                out[name] = convert(typeset(tex, td, re.sub(r"\W", "_", name)), glyphs, gidx)
            except subprocess.CalledProcessError:
                sys.exit(f"LaTeX failed for {name!r}: {tex}")
    js = ("/* AUTO-GENERATED by tools/make_equations.py — do not edit by hand.\n"
          "   LaTeX-typeset equations, labels and words as vector glyphs (1 unit = 1pt at 10pt).\n"
          "   EQ.G = shared glyph outlines (SVG path data)\n"
          "   EQ.E[id] = {w, h, u: [[glyph, x, y]...], f: filled paths, s: stroked paths} */\n"
          "window.WQ = window.WQ || {};\nWQ.EQDATA = " + json.dumps({"G": glyphs, "E": out}, separators=(",", ":")) + ";\n")
    path = os.path.join(ROOT, "js", "data", "equations.js")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f: f.write(js)
    print(f"wrote js/data/equations.js  {len(js)//1024} KB  {len(out)} items  {len(glyphs)} glyphs")

if __name__ == "__main__":
    main()
