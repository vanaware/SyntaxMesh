// deno:https://esm.sh/idb-keyval@6.2.1/denonext/idb-keyval.mjs
function u(n) {
  return new Promise((e, t) => {
    n.oncomplete = n.onsuccess = () => e(n.result), n.onabort = n.onerror = () => t(n.error);
  });
}
function f(n, e) {
  let t = indexedDB.open(n);
  t.onupgradeneeded = () => t.result.createObjectStore(e);
  let r = u(t);
  return (a, c2) => r.then((l) => c2(l.transaction(e, a).objectStore(e)));
}
var o;
function i() {
  return o || (o = f("keyval-store", "keyval")), o;
}
function d(n, e = i()) {
  return e("readonly", (t) => u(t.get(n)));
}
function y(n, e, t = i()) {
  return t("readwrite", (r) => (r.put(e, n), u(r.transaction)));
}
function h(n, e = i()) {
  return e("readwrite", (t) => (n.forEach((r) => t.put(r[1], r[0])), u(t.transaction)));
}
function p(n, e = i()) {
  return e("readonly", (t) => Promise.all(n.map((r) => u(t.get(r)))));
}
function m(n, e = i()) {
  return e("readwrite", (t) => (t.delete(n), u(t.transaction)));
}
function w(n, e = i()) {
  return e("readwrite", (t) => (n.forEach((r) => t.delete(r)), u(t.transaction)));
}
function A(n = i()) {
  return n("readwrite", (e) => (e.clear(), u(e.transaction)));
}
function s(n, e) {
  return n.openCursor().onsuccess = function() {
    this.result && (e(this.result), this.result.continue());
  }, u(n.transaction);
}
function v(n = i()) {
  return n("readonly", (e) => {
    if (e.getAllKeys) return u(e.getAllKeys());
    let t = [];
    return s(e, (r) => t.push(r.key)).then(() => t);
  });
}
function k(n = i()) {
  return n("readonly", (e) => {
    if (e.getAll && e.getAllKeys) return Promise.all([
      u(e.getAllKeys()),
      u(e.getAll())
    ]).then(([r, a]) => r.map((c2, l) => [
      c2,
      a[l]
    ]));
    let t = [];
    return n("readonly", (r) => s(r, (a) => t.push([
      a.key,
      a.value
    ])).then(() => t));
  });
}

// deno:https://esm.sh/fflate@0.8.2/es2022/fflate.mjs
var cn = {};
var Qn = function(n, r, t, e, i2) {
  var a = new Worker(cn[r] || (cn[r] = URL.createObjectURL(new Blob([
    n + ';addEventListener("error",function(e){e=e.error;postMessage({$e$:[e.message,e.code,e.stack]})})'
  ], {
    type: "text/javascript"
  }))));
  return a.onmessage = function(o2) {
    var s2 = o2.data, l = s2.$e$;
    if (l) {
      var f2 = new Error(l[0]);
      f2.code = l[1], f2.stack = l[2], i2(f2, null);
    } else i2(null, s2);
  }, a.postMessage(t, e), a;
};
var S = Uint8Array;
var W = Uint16Array;
var Zr = Int32Array;
var mr = new S([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  0,
  0,
  0
]);
var xr = new S([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  0,
  0
]);
var Cr = new S([
  16,
  17,
  18,
  0,
  8,
  7,
  9,
  6,
  10,
  5,
  11,
  4,
  12,
  3,
  13,
  2,
  14,
  1,
  15
]);
var An = function(n, r) {
  for (var t = new W(31), e = 0; e < 31; ++e) t[e] = r += 1 << n[e - 1];
  for (var i2 = new Zr(t[30]), e = 1; e < 30; ++e) for (var a = t[e]; a < t[e + 1]; ++a) i2[a] = a - t[e] << 5 | e;
  return {
    b: t,
    r: i2
  };
};
var Mn = An(mr, 2);
var tn = Mn.b;
var Nr = Mn.r;
tn[28] = 258, Nr[258] = 28;
var Sn = An(xr, 0);
var Un = Sn.b;
var Qr = Sn.r;
var Ir = new W(32768);
for (I = 0; I < 32768; ++I) tr = (I & 43690) >> 1 | (I & 21845) << 1, tr = (tr & 52428) >> 2 | (tr & 13107) << 2, tr = (tr & 61680) >> 4 | (tr & 3855) << 4, Ir[I] = ((tr & 65280) >> 8 | (tr & 255) << 8) >> 1;
var tr;
var I;
var V = function(n, r, t) {
  for (var e = n.length, i2 = 0, a = new W(r); i2 < e; ++i2) n[i2] && ++a[n[i2] - 1];
  var o2 = new W(r);
  for (i2 = 1; i2 < r; ++i2) o2[i2] = o2[i2 - 1] + a[i2 - 1] << 1;
  var s2;
  if (t) {
    s2 = new W(1 << r);
    var l = 15 - r;
    for (i2 = 0; i2 < e; ++i2) if (n[i2]) for (var f2 = i2 << 4 | n[i2], h2 = r - n[i2], u2 = o2[n[i2] - 1]++ << h2, v2 = u2 | (1 << h2) - 1; u2 <= v2; ++u2) s2[Ir[u2] >> l] = f2;
  } else for (s2 = new W(e), i2 = 0; i2 < e; ++i2) n[i2] && (s2[i2] = Ir[o2[n[i2] - 1]++] >> 15 - n[i2]);
  return s2;
};
var er = new S(288);
for (I = 0; I < 144; ++I) er[I] = 8;
var I;
for (I = 144; I < 256; ++I) er[I] = 9;
var I;
for (I = 256; I < 280; ++I) er[I] = 7;
var I;
for (I = 280; I < 288; ++I) er[I] = 8;
var I;
var yr = new S(32);
for (I = 0; I < 32; ++I) yr[I] = 5;
var I;
var Fn = V(er, 9, 0);
var Dn = V(er, 9, 1);
var Tn = V(yr, 5, 0);
var Cn = V(yr, 5, 1);
var Pr = function(n) {
  for (var r = n[0], t = 1; t < n.length; ++t) n[t] > r && (r = n[t]);
  return r;
};
var Q = function(n, r, t) {
  var e = r / 8 | 0;
  return (n[e] | n[e + 1] << 8) >> (r & 7) & t;
};
var $r = function(n, r) {
  var t = r / 8 | 0;
  return (n[t] | n[t + 1] << 8 | n[t + 2] << 16) >> (r & 7);
};
var zr = function(n) {
  return (n + 7) / 8 | 0;
};
var X = function(n, r, t) {
  return (r == null || r < 0) && (r = 0), (t == null || t > n.length) && (t = n.length), new S(n.subarray(r, t));
};
var In = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
];
var c = function(n, r, t) {
  var e = new Error(r || In[n]);
  if (e.code = n, Error.captureStackTrace && Error.captureStackTrace(e, c), !t) throw e;
  return e;
};
var Br = function(n, r, t, e) {
  var i2 = n.length, a = e ? e.length : 0;
  if (!i2 || r.f && !r.l) return t || new S(0);
  var o2 = !t, s2 = o2 || r.i != 2, l = r.i;
  o2 && (t = new S(i2 * 3));
  var f2 = function(Dr) {
    var Tr = t.length;
    if (Dr > Tr) {
      var cr = new S(Math.max(Tr * 2, Dr));
      cr.set(t), t = cr;
    }
  }, h2 = r.f || 0, u2 = r.p || 0, v2 = r.b || 0, M = r.l, m2 = r.d, z = r.m, p2 = r.n, x = i2 * 8;
  do {
    if (!M) {
      h2 = Q(n, u2, 1);
      var U = Q(n, u2 + 1, 3);
      if (u2 += 3, U) if (U == 1) M = Dn, m2 = Cn, z = 9, p2 = 5;
      else if (U == 2) {
        var B = Q(n, u2, 31) + 257, D = Q(n, u2 + 10, 15) + 4, w2 = B + Q(n, u2 + 5, 31) + 1;
        u2 += 14;
        for (var g = new S(w2), F = new S(19), T = 0; T < D; ++T) F[Cr[T]] = Q(n, u2 + T * 3, 7);
        u2 += D * 3;
        for (var O = Pr(F), H = (1 << O) - 1, G = V(F, O, 1), T = 0; T < w2; ) {
          var L = G[Q(n, u2, H)];
          u2 += L & 15;
          var A2 = L >> 4;
          if (A2 < 16) g[T++] = A2;
          else {
            var q = 0, E = 0;
            for (A2 == 16 ? (E = 3 + Q(n, u2, 3), u2 += 2, q = g[T - 1]) : A2 == 17 ? (E = 3 + Q(n, u2, 7), u2 += 3) : A2 == 18 && (E = 11 + Q(n, u2, 127), u2 += 7); E--; ) g[T++] = q;
          }
        }
        var R = g.subarray(0, B), N = g.subarray(B);
        z = Pr(R), p2 = Pr(N), M = V(R, z, 1), m2 = V(N, p2, 1);
      } else c(1);
      else {
        var A2 = zr(u2) + 4, y2 = n[A2 - 4] | n[A2 - 3] << 8, Z = A2 + y2;
        if (Z > i2) {
          l && c(0);
          break;
        }
        s2 && f2(v2 + y2), t.set(n.subarray(A2, Z), v2), r.b = v2 += y2, r.p = u2 = Z * 8, r.f = h2;
        continue;
      }
      if (u2 > x) {
        l && c(0);
        break;
      }
    }
    s2 && f2(v2 + 131072);
    for (var sr = (1 << z) - 1, Y = (1 << p2) - 1, nr = u2; ; nr = u2) {
      var q = M[$r(n, u2) & sr], j = q >> 4;
      if (u2 += q & 15, u2 > x) {
        l && c(0);
        break;
      }
      if (q || c(2), j < 256) t[v2++] = j;
      else if (j == 256) {
        nr = u2, M = null;
        break;
      } else {
        var J = j - 254;
        if (j > 264) {
          var T = j - 257, P = mr[T];
          J = Q(n, u2, (1 << P) - 1) + tn[T], u2 += P;
        }
        var _ = m2[$r(n, u2) & Y], lr = _ >> 4;
        _ || c(3), u2 += _ & 15;
        var N = Un[lr];
        if (lr > 3) {
          var P = xr[lr];
          N += $r(n, u2) & (1 << P) - 1, u2 += P;
        }
        if (u2 > x) {
          l && c(0);
          break;
        }
        s2 && f2(v2 + 131072);
        var vr = v2 + J;
        if (v2 < N) {
          var Or = a - N, qr = Math.min(N, vr);
          for (Or + v2 < 0 && c(3); v2 < qr; ++v2) t[v2] = e[Or + v2];
        }
        for (; v2 < vr; ++v2) t[v2] = t[v2 - N];
      }
    }
    r.l = M, r.p = nr, r.b = v2, r.f = h2, M && (h2 = 1, r.m = z, r.d = m2, r.n = p2);
  } while (!h2);
  return v2 != t.length && o2 ? X(t, 0, v2) : t.subarray(0, v2);
};
var rr = function(n, r, t) {
  t <<= r & 7;
  var e = r / 8 | 0;
  n[e] |= t, n[e + 1] |= t >> 8;
};
var pr = function(n, r, t) {
  t <<= r & 7;
  var e = r / 8 | 0;
  n[e] |= t, n[e + 1] |= t >> 8, n[e + 2] |= t >> 16;
};
var Hr = function(n, r) {
  for (var t = [], e = 0; e < n.length; ++e) n[e] && t.push({
    s: e,
    f: n[e]
  });
  var i2 = t.length, a = t.slice();
  if (!i2) return {
    t: ir,
    l: 0
  };
  if (i2 == 1) {
    var o2 = new S(t[0].s + 1);
    return o2[t[0].s] = 1, {
      t: o2,
      l: 1
    };
  }
  t.sort(function(Z, B) {
    return Z.f - B.f;
  }), t.push({
    s: -1,
    f: 25001
  });
  var s2 = t[0], l = t[1], f2 = 0, h2 = 1, u2 = 2;
  for (t[0] = {
    s: -1,
    f: s2.f + l.f,
    l: s2,
    r: l
  }; h2 != i2 - 1; ) s2 = t[t[f2].f < t[u2].f ? f2++ : u2++], l = t[f2 != h2 && t[f2].f < t[u2].f ? f2++ : u2++], t[h2++] = {
    s: -1,
    f: s2.f + l.f,
    l: s2,
    r: l
  };
  for (var v2 = a[0].s, e = 1; e < i2; ++e) a[e].s > v2 && (v2 = a[e].s);
  var M = new W(v2 + 1), m2 = Rr(t[h2 - 1], M, 0);
  if (m2 > r) {
    var e = 0, z = 0, p2 = m2 - r, x = 1 << p2;
    for (a.sort(function(B, D) {
      return M[D.s] - M[B.s] || B.f - D.f;
    }); e < i2; ++e) {
      var U = a[e].s;
      if (M[U] > r) z += x - (1 << m2 - M[U]), M[U] = r;
      else break;
    }
    for (z >>= p2; z > 0; ) {
      var A2 = a[e].s;
      M[A2] < r ? z -= 1 << r - M[A2]++ - 1 : ++e;
    }
    for (; e >= 0 && z; --e) {
      var y2 = a[e].s;
      M[y2] == r && (--M[y2], ++z);
    }
    m2 = r;
  }
  return {
    t: new S(M),
    l: m2
  };
};
var Rr = function(n, r, t) {
  return n.s == -1 ? Math.max(Rr(n.l, r, t + 1), Rr(n.r, r, t + 1)) : r[n.s] = t;
};
var Vr = function(n) {
  for (var r = n.length; r && !n[--r]; ) ;
  for (var t = new W(++r), e = 0, i2 = n[0], a = 1, o2 = function(l) {
    t[e++] = l;
  }, s2 = 1; s2 <= r; ++s2) if (n[s2] == i2 && s2 != r) ++a;
  else {
    if (!i2 && a > 2) {
      for (; a > 138; a -= 138) o2(32754);
      a > 2 && (o2(a > 10 ? a - 11 << 5 | 28690 : a - 3 << 5 | 12305), a = 0);
    } else if (a > 3) {
      for (o2(i2), --a; a > 6; a -= 6) o2(8304);
      a > 2 && (o2(a - 3 << 5 | 8208), a = 0);
    }
    for (; a--; ) o2(i2);
    a = 1, i2 = n[s2];
  }
  return {
    c: t.subarray(0, e),
    n: r
  };
};
var gr = function(n, r) {
  for (var t = 0, e = 0; e < r.length; ++e) t += n[e] * r[e];
  return t;
};
var en = function(n, r, t) {
  var e = t.length, i2 = zr(r + 2);
  n[i2] = e & 255, n[i2 + 1] = e >> 8, n[i2 + 2] = n[i2] ^ 255, n[i2 + 3] = n[i2 + 1] ^ 255;
  for (var a = 0; a < e; ++a) n[i2 + a + 4] = t[a];
  return (i2 + 4 + e) * 8;
};
var Xr = function(n, r, t, e, i2, a, o2, s2, l, f2, h2) {
  rr(r, h2++, t), ++i2[256];
  for (var u2 = Hr(i2, 15), v2 = u2.t, M = u2.l, m2 = Hr(a, 15), z = m2.t, p2 = m2.l, x = Vr(v2), U = x.c, A2 = x.n, y2 = Vr(z), Z = y2.c, B = y2.n, D = new W(19), w2 = 0; w2 < U.length; ++w2) ++D[U[w2] & 31];
  for (var w2 = 0; w2 < Z.length; ++w2) ++D[Z[w2] & 31];
  for (var g = Hr(D, 7), F = g.t, T = g.l, O = 19; O > 4 && !F[Cr[O - 1]]; --O) ;
  var H = f2 + 5 << 3, G = gr(i2, er) + gr(a, yr) + o2, L = gr(i2, v2) + gr(a, z) + o2 + 14 + 3 * O + gr(D, F) + 2 * D[16] + 3 * D[17] + 7 * D[18];
  if (l >= 0 && H <= G && H <= L) return en(r, h2, n.subarray(l, l + f2));
  var q, E, R, N;
  if (rr(r, h2, 1 + (L < G)), h2 += 2, L < G) {
    q = V(v2, M, 0), E = v2, R = V(z, p2, 0), N = z;
    var sr = V(F, T, 0);
    rr(r, h2, A2 - 257), rr(r, h2 + 5, B - 1), rr(r, h2 + 10, O - 4), h2 += 14;
    for (var w2 = 0; w2 < O; ++w2) rr(r, h2 + 3 * w2, F[Cr[w2]]);
    h2 += 3 * O;
    for (var Y = [
      U,
      Z
    ], nr = 0; nr < 2; ++nr) for (var j = Y[nr], w2 = 0; w2 < j.length; ++w2) {
      var J = j[w2] & 31;
      rr(r, h2, sr[J]), h2 += F[J], J > 15 && (rr(r, h2, j[w2] >> 5 & 127), h2 += j[w2] >> 12);
    }
  } else q = Fn, E = er, R = Tn, N = yr;
  for (var w2 = 0; w2 < s2; ++w2) {
    var P = e[w2];
    if (P > 255) {
      var J = P >> 18 & 31;
      pr(r, h2, q[J + 257]), h2 += E[J + 257], J > 7 && (rr(r, h2, P >> 23 & 31), h2 += mr[J]);
      var _ = P & 31;
      pr(r, h2, R[_]), h2 += N[_], _ > 3 && (pr(r, h2, P >> 5 & 8191), h2 += xr[_]);
    } else pr(r, h2, q[P]), h2 += E[P];
  }
  return pr(r, h2, q[256]), h2 + E[256];
};
var Zn = new Zr([
  65540,
  131080,
  131088,
  131104,
  262176,
  1048704,
  1048832,
  2114560,
  2117632
]);
var ir = new S(0);
var Bn = function(n, r, t, e, i2, a) {
  var o2 = a.z || n.length, s2 = new S(e + o2 + 5 * (1 + Math.ceil(o2 / 7e3)) + i2), l = s2.subarray(e, s2.length - i2), f2 = a.l, h2 = (a.r || 0) & 7;
  if (r) {
    h2 && (l[0] = a.r >> 3);
    for (var u2 = Zn[r - 1], v2 = u2 >> 13, M = u2 & 8191, m2 = (1 << t) - 1, z = a.p || new W(32768), p2 = a.h || new W(m2 + 1), x = Math.ceil(t / 3), U = 2 * x, A2 = function(Jr) {
      return (n[Jr] ^ n[Jr + 1] << x ^ n[Jr + 2] << U) & m2;
    }, y2 = new Zr(25e3), Z = new W(288), B = new W(32), D = 0, w2 = 0, g = a.i || 0, F = 0, T = a.w || 0, O = 0; g + 2 < o2; ++g) {
      var H = A2(g), G = g & 32767, L = p2[H];
      if (z[G] = L, p2[H] = G, T <= g) {
        var q = o2 - g;
        if ((D > 7e3 || F > 24576) && (q > 423 || !f2)) {
          h2 = Xr(n, l, 0, y2, Z, B, w2, F, O, g - O, h2), F = D = w2 = 0, O = g;
          for (var E = 0; E < 286; ++E) Z[E] = 0;
          for (var E = 0; E < 30; ++E) B[E] = 0;
        }
        var R = 2, N = 0, sr = M, Y = G - L & 32767;
        if (q > 2 && H == A2(g - Y)) for (var nr = Math.min(v2, q) - 1, j = Math.min(32767, g), J = Math.min(258, q); Y <= j && --sr && G != L; ) {
          if (n[g + R] == n[g + R - Y]) {
            for (var P = 0; P < J && n[g + P] == n[g + P - Y]; ++P) ;
            if (P > R) {
              if (R = P, N = Y, P > nr) break;
              for (var _ = Math.min(Y, P - 2), lr = 0, E = 0; E < _; ++E) {
                var vr = g - Y + E & 32767, Or = z[vr], qr = vr - Or & 32767;
                qr > lr && (lr = qr, L = vr);
              }
            }
          }
          G = L, L = z[G], Y += G - L & 32767;
        }
        if (N) {
          y2[F++] = 268435456 | Nr[R] << 18 | Qr[N];
          var Dr = Nr[R] & 31, Tr = Qr[N] & 31;
          w2 += mr[Dr] + xr[Tr], ++Z[257 + Dr], ++B[Tr], T = g + R, ++D;
        } else y2[F++] = n[g], ++Z[n[g]];
      }
    }
    for (g = Math.max(g, T); g < o2; ++g) y2[F++] = n[g], ++Z[n[g]];
    h2 = Xr(n, l, f2, y2, Z, B, w2, F, O, g - O, h2), f2 || (a.r = h2 & 7 | l[h2 / 8 | 0] << 3, h2 -= 7, a.h = p2, a.p = z, a.i = g, a.w = T);
  } else {
    for (var g = a.w || 0; g < o2 + f2; g += 65535) {
      var cr = g + 65535;
      cr >= o2 && (l[h2 / 8 | 0] = f2, cr = o2), h2 = en(l, h2 + 1, n.subarray(g, cr));
    }
    a.i = o2;
  }
  return X(s2, 0, e + zr(h2) + i2);
};
var En = function() {
  for (var n = new Int32Array(256), r = 0; r < 256; ++r) {
    for (var t = r, e = 9; --e; ) t = (t & 1 && -306674912) ^ t >>> 1;
    n[r] = t;
  }
  return n;
}();
var Ar = function() {
  var n = -1;
  return {
    p: function(r) {
      for (var t = n, e = 0; e < r.length; ++e) t = En[t & 255 ^ r[e]] ^ t >>> 8;
      n = t;
    },
    d: function() {
      return ~n;
    }
  };
};
var Yr = function() {
  var n = 1, r = 0;
  return {
    p: function(t) {
      for (var e = n, i2 = r, a = t.length | 0, o2 = 0; o2 != a; ) {
        for (var s2 = Math.min(o2 + 2655, a); o2 < s2; ++o2) i2 += e += t[o2];
        e = (e & 65535) + 15 * (e >> 16), i2 = (i2 & 65535) + 15 * (i2 >> 16);
      }
      n = e, r = i2;
    },
    d: function() {
      return n %= 65521, r %= 65521, (n & 255) << 24 | (n & 65280) << 8 | (r & 255) << 8 | r >> 8;
    }
  };
};
var hr = function(n, r, t, e, i2) {
  if (!i2 && (i2 = {
    l: 1
  }, r.dictionary)) {
    var a = r.dictionary.subarray(-32768), o2 = new S(a.length + n.length);
    o2.set(a), o2.set(n, a.length), n = o2, i2.w = a.length;
  }
  return Bn(n, r.level == null ? 6 : r.level, r.mem == null ? i2.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(n.length))) * 1.5) : 20 : 12 + r.mem, t, e, i2);
};
var Er = function(n, r) {
  var t = {};
  for (var e in n) t[e] = n[e];
  for (var e in r) t[e] = r[e];
  return t;
};
var pn = function(n, r, t) {
  for (var e = n(), i2 = n.toString(), a = i2.slice(i2.indexOf("[") + 1, i2.lastIndexOf("]")).replace(/\s+/g, "").split(","), o2 = 0; o2 < e.length; ++o2) {
    var s2 = e[o2], l = a[o2];
    if (typeof s2 == "function") {
      r += ";" + l + "=";
      var f2 = s2.toString();
      if (s2.prototype) if (f2.indexOf("[native code]") != -1) {
        var h2 = f2.indexOf(" ", 8) + 1;
        r += f2.slice(h2, f2.indexOf("(", h2));
      } else {
        r += f2;
        for (var u2 in s2.prototype) r += ";" + l + ".prototype." + u2 + "=" + s2.prototype[u2].toString();
      }
      else r += f2;
    } else t[l] = s2;
  }
  return r;
};
var Lr = [];
var Vn = function(n) {
  var r = [];
  for (var t in n) n[t].buffer && r.push((n[t] = new n[t].constructor(n[t])).buffer);
  return r;
};
var Gn = function(n, r, t, e) {
  if (!Lr[t]) {
    for (var i2 = "", a = {}, o2 = n.length - 1, s2 = 0; s2 < o2; ++s2) i2 = pn(n[s2], i2, a);
    Lr[t] = {
      c: pn(n[o2], i2, a),
      e: a
    };
  }
  var l = Er({}, Lr[t].e);
  return Qn(Lr[t].c + ";onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage=" + r.toString() + "}", t, l, Vn(l), e);
};
var Mr = function() {
  return [
    S,
    W,
    Zr,
    mr,
    xr,
    Cr,
    tn,
    Un,
    Dn,
    Cn,
    Ir,
    In,
    V,
    Pr,
    Q,
    $r,
    zr,
    X,
    c,
    Br,
    Gr,
    or,
    an
  ];
};
var Sr = function() {
  return [
    S,
    W,
    Zr,
    mr,
    xr,
    Cr,
    Nr,
    Qr,
    Fn,
    er,
    Tn,
    yr,
    Ir,
    Zn,
    ir,
    V,
    rr,
    pr,
    Hr,
    Rr,
    Vr,
    gr,
    en,
    Xr,
    zr,
    X,
    Bn,
    hr,
    jr,
    or
  ];
};
var qn = function() {
  return [
    sn,
    $n
  ];
};
var Pn = function() {
  return [
    un
  ];
};
var or = function(n) {
  return postMessage(n, [
    n.buffer
  ]);
};
var an = function(n) {
  return n && {
    out: n.size && new S(n.size),
    dictionary: n.dictionary
  };
};
var d2 = function(n) {
  return n.ondata = function(r, t) {
    return postMessage([
      r,
      t
    ], [
      r.buffer
    ]);
  }, function(r) {
    r.data.length ? (n.push(r.data[0], r.data[1]), postMessage([
      r.data[0].length
    ])) : n.flush();
  };
};
var Fr = function(n, r, t, e, i2, a, o2) {
  var s2, l = Gn(n, e, i2, function(f2, h2) {
    f2 ? (l.terminate(), r.ondata.call(r, f2)) : Array.isArray(h2) ? h2.length == 1 ? (r.queuedSize -= h2[0], r.ondrain && r.ondrain(h2[0])) : (h2[1] && l.terminate(), r.ondata.call(r, f2, h2[0], h2[1])) : o2(h2);
  });
  l.postMessage(t), r.queuedSize = 0, r.push = function(f2, h2) {
    r.ondata || c(5), s2 && r.ondata(c(4, 0, 1), null, !!h2), r.queuedSize += f2.length, l.postMessage([
      f2,
      s2 = h2
    ], [
      f2.buffer
    ]);
  }, r.terminate = function() {
    l.terminate();
  }, a && (r.flush = function() {
    l.postMessage([]);
  });
};
var k2 = function(n, r) {
  return n[r] | n[r + 1] << 8;
};
var $ = function(n, r) {
  return (n[r] | n[r + 1] << 8 | n[r + 2] << 16 | n[r + 3] << 24) >>> 0;
};
var Kr = function(n, r) {
  return $(n, r) + $(n, r + 4) * 4294967296;
};
var C = function(n, r, t) {
  for (; t; ++r) n[r] = t, t >>>= 8;
};
var on = function(n, r) {
  var t = r.filename;
  if (n[0] = 31, n[1] = 139, n[2] = 8, n[8] = r.level < 2 ? 4 : r.level == 9 ? 2 : 0, n[9] = 3, r.mtime != 0 && C(n, 4, Math.floor(new Date(r.mtime || Date.now()) / 1e3)), t) {
    n[3] = 8;
    for (var e = 0; e <= t.length; ++e) n[e + 10] = t.charCodeAt(e);
  }
};
var sn = function(n) {
  (n[0] != 31 || n[1] != 139 || n[2] != 8) && c(6, "invalid gzip data");
  var r = n[3], t = 10;
  r & 4 && (t += (n[10] | n[11] << 8) + 2);
  for (var e = (r >> 3 & 1) + (r >> 4 & 1); e > 0; e -= !n[t++]) ;
  return t + (r & 2);
};
var $n = function(n) {
  var r = n.length;
  return (n[r - 4] | n[r - 3] << 8 | n[r - 2] << 16 | n[r - 1] << 24) >>> 0;
};
var fn = function(n) {
  return 10 + (n.filename ? n.filename.length + 1 : 0);
};
var hn = function(n, r) {
  var t = r.level, e = t == 0 ? 0 : t < 6 ? 1 : t == 9 ? 3 : 2;
  if (n[0] = 120, n[1] = e << 6 | (r.dictionary && 32), n[1] |= 31 - (n[0] << 8 | n[1]) % 31, r.dictionary) {
    var i2 = Yr();
    i2.p(r.dictionary), C(n, 2, i2.d());
  }
};
var un = function(n, r) {
  return ((n[0] & 15) != 8 || n[0] >> 4 > 7 || (n[0] << 8 | n[1]) % 31) && c(6, "invalid zlib data"), (n[1] >> 5 & 1) == +!r && c(6, "invalid zlib data: " + (n[1] & 32 ? "need" : "unexpected") + " dictionary"), (n[1] >> 3 & 4) + 2;
};
function ur(n, r) {
  return typeof n == "function" && (r = n, n = {}), this.ondata = r, n;
}
var b = function() {
  function n(r, t) {
    if (typeof r == "function" && (t = r, r = {}), this.ondata = t, this.o = r || {}, this.s = {
      l: 0,
      i: 32768,
      w: 32768,
      z: 32768
    }, this.b = new S(98304), this.o.dictionary) {
      var e = this.o.dictionary.subarray(-32768);
      this.b.set(e, 32768 - e.length), this.s.i = 32768 - e.length;
    }
  }
  return n.prototype.p = function(r, t) {
    this.ondata(hr(r, this.o, 0, 0, this.s), t);
  }, n.prototype.push = function(r, t) {
    this.ondata || c(5), this.s.l && c(4);
    var e = r.length + this.s.z;
    if (e > this.b.length) {
      if (e > 2 * this.b.length - 32768) {
        var i2 = new S(e & -32768);
        i2.set(this.b.subarray(0, this.s.z)), this.b = i2;
      }
      var a = this.b.length - this.s.z;
      this.b.set(r.subarray(0, a), this.s.z), this.s.z = this.b.length, this.p(this.b, false), this.b.set(this.b.subarray(-32768)), this.b.set(r.subarray(a), 32768), this.s.z = r.length - a + 32768, this.s.i = 32766, this.s.w = 32768;
    } else this.b.set(r, this.s.z), this.s.z += r.length;
    this.s.l = t & 1, (this.s.z > this.s.w + 8191 || t) && (this.p(this.b, t || false), this.s.w = this.s.i, this.s.i -= 2);
  }, n.prototype.flush = function() {
    this.ondata || c(5), this.s.l && c(4), this.p(this.b, false), this.s.w = this.s.i, this.s.i -= 2;
  }, n;
}();
var Xn = /* @__PURE__ */ function() {
  function n(r, t) {
    Fr([
      Sr,
      function() {
        return [
          d2,
          b
        ];
      }
    ], this, ur.call(this, r, t), function(e) {
      var i2 = new b(e.data);
      onmessage = d2(i2);
    }, 6, 1);
  }
  return n;
}();
function jr(n, r) {
  return hr(n, r || {}, 0, 0);
}
var K = function() {
  function n(r, t) {
    typeof r == "function" && (t = r, r = {}), this.ondata = t;
    var e = r && r.dictionary && r.dictionary.subarray(-32768);
    this.s = {
      i: 0,
      b: e ? e.length : 0
    }, this.o = new S(32768), this.p = new S(0), e && this.o.set(e);
  }
  return n.prototype.e = function(r) {
    if (this.ondata || c(5), this.d && c(4), !this.p.length) this.p = r;
    else if (r.length) {
      var t = new S(this.p.length + r.length);
      t.set(this.p), t.set(r, this.p.length), this.p = t;
    }
  }, n.prototype.c = function(r) {
    this.s.i = +(this.d = r || false);
    var t = this.s.b, e = Br(this.p, this.s, this.o);
    this.ondata(X(e, t, this.s.b), this.d), this.o = X(e, this.s.b - 32768), this.s.b = this.o.length, this.p = X(this.p, this.s.p / 8 | 0), this.s.p &= 7;
  }, n.prototype.push = function(r, t) {
    this.e(r), this.c(t);
  }, n;
}();
var Hn = /* @__PURE__ */ function() {
  function n(r, t) {
    Fr([
      Mr,
      function() {
        return [
          d2,
          K
        ];
      }
    ], this, ur.call(this, r, t), function(e) {
      var i2 = new K(e.data);
      onmessage = d2(i2);
    }, 7, 0);
  }
  return n;
}();
function Gr(n, r) {
  return Br(n, {
    i: 2
  }, r && r.out, r && r.dictionary);
}
var gn = function() {
  function n(r, t) {
    this.c = Ar(), this.l = 0, this.v = 1, b.call(this, r, t);
  }
  return n.prototype.push = function(r, t) {
    this.c.p(r), this.l += r.length, b.prototype.push.call(this, r, t);
  }, n.prototype.p = function(r, t) {
    var e = hr(r, this.o, this.v && fn(this.o), t && 8, this.s);
    this.v && (on(e, this.o), this.v = 0), t && (C(e, e.length - 8, this.c.d()), C(e, e.length - 4, this.l)), this.ondata(e, t);
  }, n.prototype.flush = function() {
    b.prototype.flush.call(this);
  }, n;
}();
var dr = function() {
  function n(r, t) {
    this.v = 1, this.r = 0, K.call(this, r, t);
  }
  return n.prototype.push = function(r, t) {
    if (K.prototype.e.call(this, r), this.r += r.length, this.v) {
      var e = this.p.subarray(this.v - 1), i2 = e.length > 3 ? sn(e) : 4;
      if (i2 > e.length) {
        if (!t) return;
      } else this.v > 1 && this.onmember && this.onmember(this.r - e.length);
      this.p = e.subarray(i2), this.v = 0;
    }
    K.prototype.c.call(this, t), this.s.f && !this.s.l && !t && (this.v = zr(this.s.p) + 9, this.s = {
      i: 0
    }, this.o = new S(0), this.push(new S(0), t));
  }, n;
}();
var bn = /* @__PURE__ */ function() {
  function n(r, t) {
    var e = this;
    Fr([
      Mr,
      qn,
      function() {
        return [
          d2,
          K,
          dr
        ];
      }
    ], this, ur.call(this, r, t), function(i2) {
      var a = new dr(i2.data);
      a.onmember = function(o2) {
        return postMessage(o2);
      }, onmessage = d2(a);
    }, 9, 0, function(i2) {
      return e.onmember && e.onmember(i2);
    });
  }
  return n;
}();
var wn = function() {
  function n(r, t) {
    this.c = Yr(), this.v = 1, b.call(this, r, t);
  }
  return n.prototype.push = function(r, t) {
    this.c.p(r), b.prototype.push.call(this, r, t);
  }, n.prototype.p = function(r, t) {
    var e = hr(r, this.o, this.v && (this.o.dictionary ? 6 : 2), t && 4, this.s);
    this.v && (hn(e, this.o), this.v = 0), t && C(e, e.length - 4, this.c.d()), this.ondata(e, t);
  }, n.prototype.flush = function() {
    b.prototype.flush.call(this);
  }, n;
}();
var _r = function() {
  function n(r, t) {
    K.call(this, r, t), this.v = r && r.dictionary ? 2 : 1;
  }
  return n.prototype.push = function(r, t) {
    if (K.prototype.e.call(this, r), this.v) {
      if (this.p.length < 6 && !t) return;
      this.p = this.p.subarray(un(this.p, this.v - 1)), this.v = 0;
    }
    t && (this.p.length < 4 && c(6, "invalid zlib data"), this.p = this.p.subarray(0, -4)), K.prototype.c.call(this, t);
  }, n;
}();
var rt = /* @__PURE__ */ function() {
  function n(r, t) {
    Fr([
      Mr,
      Pn,
      function() {
        return [
          d2,
          K,
          _r
        ];
      }
    ], this, ur.call(this, r, t), function(e) {
      var i2 = new _r(e.data);
      onmessage = d2(i2);
    }, 11, 0);
  }
  return n;
}();
var xn = function() {
  function n(r, t) {
    this.o = ur.call(this, r, t) || {}, this.G = dr, this.I = K, this.Z = _r;
  }
  return n.prototype.i = function() {
    var r = this;
    this.s.ondata = function(t, e) {
      r.ondata(t, e);
    };
  }, n.prototype.push = function(r, t) {
    if (this.ondata || c(5), this.s) this.s.push(r, t);
    else {
      if (this.p && this.p.length) {
        var e = new S(this.p.length + r.length);
        e.set(this.p), e.set(r, this.p.length);
      } else this.p = r;
      this.p.length > 2 && (this.s = this.p[0] == 31 && this.p[1] == 139 && this.p[2] == 8 ? new this.G(this.o) : (this.p[0] & 15) != 8 || this.p[0] >> 4 > 7 || (this.p[0] << 8 | this.p[1]) % 31 ? new this.I(this.o) : new this.Z(this.o), this.i(), this.s.push(this.p, t), this.p = null);
    }
  }, n;
}();
var ft = function() {
  function n(r, t) {
    xn.call(this, r, t), this.queuedSize = 0, this.G = bn, this.I = Hn, this.Z = rt;
  }
  return n.prototype.i = function() {
    var r = this;
    this.s.ondata = function(t, e, i2) {
      r.ondata(t, e, i2);
    }, this.s.ondrain = function(t) {
      r.queuedSize -= t, r.ondrain && r.ondrain(t);
    };
  }, n.prototype.push = function(r, t) {
    this.queuedSize += r.length, xn.prototype.push.call(this, r, t);
  }, n;
}();
var ln = function(n, r, t, e) {
  for (var i2 in n) {
    var a = n[i2], o2 = r + i2, s2 = e;
    Array.isArray(a) && (s2 = Er(e, a[1]), a = a[0]), a instanceof S ? t[o2] = [
      a,
      s2
    ] : (t[o2 += "/"] = [
      new S(0),
      s2
    ], ln(a, o2, t, e));
  }
};
var zn = typeof TextEncoder < "u" && new TextEncoder();
var nn = typeof TextDecoder < "u" && new TextDecoder();
var Rn = 0;
try {
  nn.decode(ir, {
    stream: true
  }), Rn = 1;
} catch {
}
var kn = function(n) {
  for (var r = "", t = 0; ; ) {
    var e = n[t++], i2 = (e > 127) + (e > 223) + (e > 239);
    if (t + i2 > n.length) return {
      s: r,
      r: X(n, t - 1)
    };
    i2 ? i2 == 3 ? (e = ((e & 15) << 18 | (n[t++] & 63) << 12 | (n[t++] & 63) << 6 | n[t++] & 63) - 65536, r += String.fromCharCode(55296 | e >> 10, 56320 | e & 1023)) : i2 & 1 ? r += String.fromCharCode((e & 31) << 6 | n[t++] & 63) : r += String.fromCharCode((e & 15) << 12 | (n[t++] & 63) << 6 | n[t++] & 63) : r += String.fromCharCode(e);
  }
};
var lt = function() {
  function n(r) {
    this.ondata = r, Rn ? this.t = new TextDecoder() : this.p = ir;
  }
  return n.prototype.push = function(r, t) {
    if (this.ondata || c(5), t = !!t, this.t) {
      this.ondata(this.t.decode(r, {
        stream: true
      }), t), t && (this.t.decode().length && c(8), this.t = null);
      return;
    }
    this.p || c(4);
    var e = new S(this.p.length + r.length);
    e.set(this.p), e.set(r, this.p.length);
    var i2 = kn(e), a = i2.s, o2 = i2.r;
    t ? (o2.length && c(8), this.p = null) : this.p = o2, this.ondata(a, t);
  }, n;
}();
var vt = function() {
  function n(r) {
    this.ondata = r;
  }
  return n.prototype.push = function(r, t) {
    this.ondata || c(5), this.d && c(4), this.ondata(fr(r), this.d = t || false);
  }, n;
}();
function fr(n, r) {
  if (r) {
    for (var t = new S(n.length), e = 0; e < n.length; ++e) t[e] = n.charCodeAt(e);
    return t;
  }
  if (zn) return zn.encode(n);
  for (var i2 = n.length, a = new S(n.length + (n.length >> 1)), o2 = 0, s2 = function(h2) {
    a[o2++] = h2;
  }, e = 0; e < i2; ++e) {
    if (o2 + 5 > a.length) {
      var l = new S(o2 + 8 + (i2 - e << 1));
      l.set(a), a = l;
    }
    var f2 = n.charCodeAt(e);
    f2 < 128 || r ? s2(f2) : f2 < 2048 ? (s2(192 | f2 >> 6), s2(128 | f2 & 63)) : f2 > 55295 && f2 < 57344 ? (f2 = 65536 + (f2 & 1047552) | n.charCodeAt(++e) & 1023, s2(240 | f2 >> 18), s2(128 | f2 >> 12 & 63), s2(128 | f2 >> 6 & 63), s2(128 | f2 & 63)) : (s2(224 | f2 >> 12), s2(128 | f2 >> 6 & 63), s2(128 | f2 & 63));
  }
  return X(a, 0, o2);
}
function Wn(n, r) {
  if (r) {
    for (var t = "", e = 0; e < n.length; e += 16384) t += String.fromCharCode.apply(null, n.subarray(e, e + 16384));
    return t;
  } else {
    if (nn) return nn.decode(n);
    var i2 = kn(n), a = i2.s, t = i2.r;
    return t.length && c(8), a;
  }
}
var Yn = function(n) {
  return n == 1 ? 3 : n < 6 ? 2 : n == 9 ? 1 : 0;
};
var jn = function(n, r) {
  return r + 30 + k2(n, r + 26) + k2(n, r + 28);
};
var Jn = function(n, r, t) {
  var e = k2(n, r + 28), i2 = Wn(n.subarray(r + 46, r + 46 + e), !(k2(n, r + 8) & 2048)), a = r + 46 + e, o2 = $(n, r + 20), s2 = t && o2 == 4294967295 ? Kn(n, a) : [
    o2,
    $(n, r + 24),
    $(n, r + 42)
  ], l = s2[0], f2 = s2[1], h2 = s2[2];
  return [
    k2(n, r + 10),
    l,
    f2,
    i2,
    a + k2(n, r + 30) + k2(n, r + 32),
    h2
  ];
};
var Kn = function(n, r) {
  for (; k2(n, r) != 1; r += 4 + k2(n, r + 2)) ;
  return [
    Kr(n, r + 12),
    Kr(n, r + 4),
    Kr(n, r + 20)
  ];
};
var ar = function(n) {
  var r = 0;
  if (n) for (var t in n) {
    var e = n[t].length;
    e > 65535 && c(9), r += e + 4;
  }
  return r;
};
var wr = function(n, r, t, e, i2, a, o2, s2) {
  var l = e.length, f2 = t.extra, h2 = s2 && s2.length, u2 = ar(f2);
  C(n, r, o2 != null ? 33639248 : 67324752), r += 4, o2 != null && (n[r++] = 20, n[r++] = t.os), n[r] = 20, r += 2, n[r++] = t.flag << 1 | (a < 0 && 8), n[r++] = i2 && 8, n[r++] = t.compression & 255, n[r++] = t.compression >> 8;
  var v2 = new Date(t.mtime == null ? Date.now() : t.mtime), M = v2.getFullYear() - 1980;
  if ((M < 0 || M > 119) && c(10), C(n, r, M << 25 | v2.getMonth() + 1 << 21 | v2.getDate() << 16 | v2.getHours() << 11 | v2.getMinutes() << 5 | v2.getSeconds() >> 1), r += 4, a != -1 && (C(n, r, t.crc), C(n, r + 4, a < 0 ? -a - 2 : a), C(n, r + 8, t.size)), C(n, r + 12, l), C(n, r + 14, u2), r += 16, o2 != null && (C(n, r, h2), C(n, r + 6, t.attrs), C(n, r + 10, o2), r += 14), n.set(e, r), r += l, u2) for (var m2 in f2) {
    var z = f2[m2], p2 = z.length;
    C(n, r, +m2), C(n, r + 2, p2), n.set(z, r + 4), r += 4 + p2;
  }
  return h2 && (n.set(s2, r), r += h2), r;
};
var vn = function(n, r, t, e, i2) {
  C(n, r, 101010256), C(n, r + 8, t), C(n, r + 10, t), C(n, r + 12, e), C(n, r + 16, i2);
};
var kr = function() {
  function n(r) {
    this.filename = r, this.c = Ar(), this.size = 0, this.compression = 0;
  }
  return n.prototype.process = function(r, t) {
    this.ondata(null, r, t);
  }, n.prototype.push = function(r, t) {
    this.ondata || c(5), this.c.p(r), this.size += r.length, t && (this.crc = this.c.d()), this.process(r, t || false);
  }, n;
}();
var ct = function() {
  function n(r, t) {
    var e = this;
    t || (t = {}), kr.call(this, r), this.d = new b(t, function(i2, a) {
      e.ondata(null, i2, a);
    }), this.compression = 8, this.flag = Yn(t.level);
  }
  return n.prototype.process = function(r, t) {
    try {
      this.d.push(r, t);
    } catch (e) {
      this.ondata(e, null, t);
    }
  }, n.prototype.push = function(r, t) {
    kr.prototype.push.call(this, r, t);
  }, n;
}();
var pt = function() {
  function n(r, t) {
    var e = this;
    t || (t = {}), kr.call(this, r), this.d = new Xn(t, function(i2, a, o2) {
      e.ondata(i2, a, o2);
    }), this.compression = 8, this.flag = Yn(t.level), this.terminate = this.d.terminate;
  }
  return n.prototype.process = function(r, t) {
    this.d.push(r, t);
  }, n.prototype.push = function(r, t) {
    kr.prototype.push.call(this, r, t);
  }, n;
}();
var gt = function() {
  function n(r) {
    this.ondata = r, this.u = [], this.d = 1;
  }
  return n.prototype.add = function(r) {
    var t = this;
    if (this.ondata || c(5), this.d & 2) this.ondata(c(4 + (this.d & 1) * 8, 0, 1), null, false);
    else {
      var e = fr(r.filename), i2 = e.length, a = r.comment, o2 = a && fr(a), s2 = i2 != r.filename.length || o2 && a.length != o2.length, l = i2 + ar(r.extra) + 30;
      i2 > 65535 && this.ondata(c(11, 0, 1), null, false);
      var f2 = new S(l);
      wr(f2, 0, r, e, s2, -1);
      var h2 = [
        f2
      ], u2 = function() {
        for (var p2 = 0, x = h2; p2 < x.length; p2++) {
          var U = x[p2];
          t.ondata(null, U, false);
        }
        h2 = [];
      }, v2 = this.d;
      this.d = 0;
      var M = this.u.length, m2 = Er(r, {
        f: e,
        u: s2,
        o: o2,
        t: function() {
          r.terminate && r.terminate();
        },
        r: function() {
          if (u2(), v2) {
            var p2 = t.u[M + 1];
            p2 ? p2.r() : t.d = 1;
          }
          v2 = 1;
        }
      }), z = 0;
      r.ondata = function(p2, x, U) {
        if (p2) t.ondata(p2, x, U), t.terminate();
        else if (z += x.length, h2.push(x), U) {
          var A2 = new S(16);
          C(A2, 0, 134695760), C(A2, 4, r.crc), C(A2, 8, z), C(A2, 12, r.size), h2.push(A2), m2.c = z, m2.b = l + z + 16, m2.crc = r.crc, m2.size = r.size, v2 && m2.r(), v2 = 1;
        } else v2 && u2();
      }, this.u.push(m2);
    }
  }, n.prototype.end = function() {
    var r = this;
    if (this.d & 2) {
      this.ondata(c(4 + (this.d & 1) * 8, 0, 1), null, true);
      return;
    }
    this.d ? this.e() : this.u.push({
      r: function() {
        r.d & 1 && (r.u.splice(-1, 1), r.e());
      },
      t: function() {
      }
    }), this.d = 3;
  }, n.prototype.e = function() {
    for (var r = 0, t = 0, e = 0, i2 = 0, a = this.u; i2 < a.length; i2++) {
      var o2 = a[i2];
      e += 46 + o2.f.length + ar(o2.extra) + (o2.o ? o2.o.length : 0);
    }
    for (var s2 = new S(e + 22), l = 0, f2 = this.u; l < f2.length; l++) {
      var o2 = f2[l];
      wr(s2, r, o2, o2.f, o2.u, -o2.c - 2, t, o2.o), r += 46 + o2.f.length + ar(o2.extra) + (o2.o ? o2.o.length : 0), t += o2.b;
    }
    vn(s2, r, this.u.length, e, t), this.ondata(null, s2, true), this.d = 2;
  }, n.prototype.terminate = function() {
    for (var r = 0, t = this.u; r < t.length; r++) {
      var e = t[r];
      e.t();
    }
    this.d = 2;
  }, n;
}();
function wt(n, r) {
  r || (r = {});
  var t = {}, e = [];
  ln(n, "", t, r);
  var i2 = 0, a = 0;
  for (var o2 in t) {
    var s2 = t[o2], l = s2[0], f2 = s2[1], h2 = f2.level == 0 ? 0 : 8, u2 = fr(o2), v2 = u2.length, M = f2.comment, m2 = M && fr(M), z = m2 && m2.length, p2 = ar(f2.extra);
    v2 > 65535 && c(11);
    var x = h2 ? jr(l, f2) : l, U = x.length, A2 = Ar();
    A2.p(l), e.push(Er(f2, {
      size: l.length,
      crc: A2.d(),
      c: x,
      f: u2,
      m: m2,
      u: v2 != o2.length || m2 && M.length != z,
      o: i2,
      compression: h2
    })), i2 += 30 + v2 + p2 + U, a += 76 + 2 * (v2 + p2) + (z || 0) + U;
  }
  for (var y2 = new S(a + 22), Z = i2, B = a - i2, D = 0; D < e.length; ++D) {
    var u2 = e[D];
    wr(y2, u2.o, u2, u2.f, u2.u, u2.c.length);
    var w2 = 30 + u2.f.length + ar(u2.extra);
    y2.set(u2.c, u2.o + w2), wr(y2, i2, u2, u2.f, u2.u, u2.c.length, u2.o, u2.m), i2 += 16 + w2 + (u2.m ? u2.m.length : 0);
  }
  return vn(y2, i2, e.length, B, Z), y2;
}
var tt = function() {
  function n() {
  }
  return n.prototype.push = function(r, t) {
    this.ondata(null, r, t);
  }, n.compression = 0, n;
}();
var mt = function() {
  function n() {
    var r = this;
    this.i = new K(function(t, e) {
      r.ondata(null, t, e);
    });
  }
  return n.prototype.push = function(r, t) {
    try {
      this.i.push(r, t);
    } catch (e) {
      this.ondata(e, null, t);
    }
  }, n.compression = 8, n;
}();
var xt = function() {
  function n(r, t) {
    var e = this;
    t < 32e4 ? this.i = new K(function(i2, a) {
      e.ondata(null, i2, a);
    }) : (this.i = new Hn(function(i2, a, o2) {
      e.ondata(i2, a, o2);
    }), this.terminate = this.i.terminate);
  }
  return n.prototype.push = function(r, t) {
    this.i.terminate && (r = X(r, 0)), this.i.push(r, t);
  }, n.compression = 8, n;
}();
var zt = function() {
  function n(r) {
    this.onfile = r, this.k = [], this.o = {
      0: tt
    }, this.p = ir;
  }
  return n.prototype.push = function(r, t) {
    var e = this;
    if (this.onfile || c(5), this.p || c(4), this.c > 0) {
      var i2 = Math.min(this.c, r.length), a = r.subarray(0, i2);
      if (this.c -= i2, this.d ? this.d.push(a, !this.c) : this.k[0].push(a), r = r.subarray(i2), r.length) return this.push(r, t);
    } else {
      var o2 = 0, s2 = 0, l = void 0, f2 = void 0;
      this.p.length ? r.length ? (f2 = new S(this.p.length + r.length), f2.set(this.p), f2.set(r, this.p.length)) : f2 = this.p : f2 = r;
      for (var h2 = f2.length, u2 = this.c, v2 = u2 && this.d, M = function() {
        var x, U = $(f2, s2);
        if (U == 67324752) {
          o2 = 1, l = s2, m2.d = null, m2.c = 0;
          var A2 = k2(f2, s2 + 6), y2 = k2(f2, s2 + 8), Z = A2 & 2048, B = A2 & 8, D = k2(f2, s2 + 26), w2 = k2(f2, s2 + 28);
          if (h2 > s2 + 30 + D + w2) {
            var g = [];
            m2.k.unshift(g), o2 = 2;
            var F = $(f2, s2 + 18), T = $(f2, s2 + 22), O = Wn(f2.subarray(s2 + 30, s2 += 30 + D), !Z);
            F == 4294967295 ? (x = B ? [
              -2
            ] : Kn(f2, s2), F = x[0], T = x[1]) : B && (F = -1), s2 += w2, m2.c = F;
            var H, G = {
              name: O,
              compression: y2,
              start: function() {
                if (G.ondata || c(5), !F) G.ondata(null, ir, true);
                else {
                  var L = e.o[y2];
                  L || G.ondata(c(14, "unknown compression type " + y2, 1), null, false), H = F < 0 ? new L(O) : new L(O, F, T), H.ondata = function(N, sr, Y) {
                    G.ondata(N, sr, Y);
                  };
                  for (var q = 0, E = g; q < E.length; q++) {
                    var R = E[q];
                    H.push(R, false);
                  }
                  e.k[0] == g && e.c ? e.d = H : H.push(ir, true);
                }
              },
              terminate: function() {
                H && H.terminate && H.terminate();
              }
            };
            F >= 0 && (G.size = F, G.originalSize = T), m2.onfile(G);
          }
          return "break";
        } else if (u2) {
          if (U == 134695760) return l = s2 += 12 + (u2 == -2 && 8), o2 = 3, m2.c = 0, "break";
          if (U == 33639248) return l = s2 -= 4, o2 = 3, m2.c = 0, "break";
        }
      }, m2 = this; s2 < h2 - 4; ++s2) {
        var z = M();
        if (z === "break") break;
      }
      if (this.p = ir, u2 < 0) {
        var p2 = o2 ? f2.subarray(0, l - 12 - (u2 == -2 && 8) - ($(f2, l - 16) == 134695760 && 4)) : f2.subarray(0, s2);
        v2 ? v2.push(p2, !!o2) : this.k[+(o2 == 2)].push(p2);
      }
      if (o2 & 2) return this.push(f2.subarray(s2), t);
      this.p = f2.subarray(s2);
    }
    t && (this.c && c(13), this.p = null);
  }, n.prototype.register = function(r) {
    this.o[r.compression] = r;
  }, n;
}();
function Mt(n, r) {
  for (var t = {}, e = n.length - 22; $(n, e) != 101010256; --e) (!e || n.length - e > 65558) && c(13);
  var i2 = k2(n, e + 8);
  if (!i2) return {};
  var a = $(n, e + 16), o2 = a == 4294967295 || i2 == 65535;
  if (o2) {
    var s2 = $(n, e - 12);
    o2 = $(n, s2) == 101075792, o2 && (i2 = $(n, s2 + 32), a = $(n, s2 + 48));
  }
  for (var l = r && r.filter, f2 = 0; f2 < i2; ++f2) {
    var h2 = Jn(n, a, o2), u2 = h2[0], v2 = h2[1], M = h2[2], m2 = h2[3], z = h2[4], p2 = h2[5], x = jn(n, p2);
    a = z, (!l || l({
      name: m2,
      size: v2,
      originalSize: M,
      compression: u2
    })) && (u2 ? u2 == 8 ? t[m2] = Gr(n.subarray(x, x + v2), {
      out: new S(M)
    }) : c(14, "unknown compression type " + u2) : t[m2] = X(n, x, x + v2));
  }
  return t;
}

// src/utils/id-utils.ts
function gerarId() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("").substring(0, 12);
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
function gerarIdComPrefixo(prefix) {
  return `${prefix}${gerarId()}`;
}
function formatDbItem(key, val, prefix = "") {
  if (!val || typeof val !== "object" || Array.isArray(val)) return val;
  const keyStr = String(key);
  const _id = prefix && keyStr.startsWith(prefix) ? keyStr.slice(prefix.length) : keyStr;
  return {
    _id,
    ...val
  };
}
function prepareForSave(key, val, prefix = "") {
  let rawId = val && typeof val === "object" ? val._id : void 0;
  if (rawId === "auto") {
    rawId = gerarId();
  }
  let processKey = key === "auto" ? gerarId() : key;
  let finalKey = processKey || "";
  if (rawId) {
    if (prefix && rawId.startsWith(prefix)) {
      finalKey = rawId;
    } else {
      finalKey = prefix ? `${prefix}${rawId}` : rawId;
    }
  } else if (processKey) {
    if (prefix && processKey.startsWith(prefix)) {
      finalKey = processKey;
    } else {
      finalKey = prefix ? `${prefix}${processKey}` : processKey;
    }
  }
  if (!finalKey) {
    throw new Error("Uma chave (key) ou um atributo '_id' no objeto deve ser fornecido.");
  }
  if (val && typeof val === "object" && !Array.isArray(val) && "_id" in val) {
    const { _id: _, ...cleanVal } = val;
    return {
      key: finalKey,
      cleanVal
    };
  }
  return {
    key: finalKey,
    cleanVal: val
  };
}

// src/db-sw.ts
var storeCache = /* @__PURE__ */ new Map();
function getCustomStore(dbName, storeName = "keyval") {
  if (!dbName) return void 0;
  const cacheKey = `${dbName}:${storeName}`;
  if (!storeCache.has(cacheKey)) storeCache.set(cacheKey, f(dbName, storeName));
  return storeCache.get(cacheKey);
}
function formatDbEntries(rawEntries, prefix) {
  let items = rawEntries;
  if (prefix) items = items.filter(([k3]) => typeof k3 === "string" && k3.startsWith(prefix));
  return items.map(([k3, v2]) => formatDbItem(k3, v2, prefix));
}
async function getRecordDir(basePath = "", rawKey, create = false) {
  const root = await navigator.storage.getDirectory();
  const fullPath = basePath ? `${basePath}/${rawKey}` : rawKey;
  const parts = fullPath.split("/").filter(Boolean);
  let curr = root;
  for (const p2 of parts) curr = await curr.getDirectoryHandle(p2, {
    create
  });
  return curr;
}
var globalSwDbAPI = {
  get: async (key, opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const val = await d(rawKey, store);
    return val !== void 0 ? formatDbItem(rawKey, val, opts?.prefix) : void 0;
  },
  set: async (keyOrVal, val, opts) => {
    let keyToSave;
    let valToSave;
    let options = opts || {};
    if (typeof keyOrVal !== "string") {
      keyToSave = void 0;
      valToSave = keyOrVal;
      if (val) options = val;
    } else {
      keyToSave = keyOrVal;
      valToSave = val;
    }
    const store = getCustomStore(options.dbName, options.storeName);
    const { key, cleanVal } = prepareForSave(keyToSave, valToSave, options.prefix);
    await y(key, cleanVal, store);
    return key;
  },
  update: async (key, updater, opts) => {
    const currentVal = await globalSwDbAPI.get(key, opts);
    const newVal = updater(currentVal);
    await globalSwDbAPI.set(key, newVal, opts);
  },
  patch: async (key, patchOrFn, context, opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const current = await d(rawKey, store) || {};
    let updated;
    if (typeof patchOrFn === "function") {
      updated = patchOrFn(formatDbItem(rawKey, current, opts?.prefix), context);
    } else {
      updated = Object.assign({}, current, patchOrFn);
    }
    const { key: finalKey, cleanVal } = prepareForSave(rawKey, updated, opts?.prefix);
    await y(finalKey, cleanVal, store);
    return formatDbItem(finalKey, cleanVal, opts?.prefix);
  },
  delete: async (key, opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    await m(rawKey, store);
  },
  getMany: async (keysList, opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const fullKeys = keysList.map((k3) => opts?.prefix && !k3.startsWith(opts.prefix) ? `${opts.prefix}${k3}` : k3);
    const rawValues = await p(fullKeys, store);
    return rawValues.map((val, idx) => val !== void 0 ? formatDbItem(fullKeys[idx], val, opts?.prefix) : void 0);
  },
  setMany: async (entriesList, opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const entriesToSet = entriesList.map(([k3, v2]) => {
      const { key, cleanVal } = prepareForSave(k3, v2, opts?.prefix);
      return [
        key,
        cleanVal
      ];
    });
    await h(entriesToSet, store);
  },
  deleteMany: async (keysList, opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const fullKeys = keysList.map((k3) => opts?.prefix && !k3.startsWith(opts.prefix) ? `${opts.prefix}${k3}` : k3);
    await w(fullKeys, store);
  },
  keys: async (opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const allKeys = await v(store);
    return opts?.prefix ? allKeys.filter((k3) => typeof k3 === "string" && k3.startsWith(opts.prefix)) : allKeys;
  },
  values: async (opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const allEntries = await k(store);
    return formatDbEntries(allEntries, opts?.prefix);
  },
  entries: async (opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const allEntries = await k(store);
    return opts?.prefix ? allEntries.filter(([k3]) => typeof k3 === "string" && k3.startsWith(opts.prefix)) : allEntries;
  },
  clear: async (opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    if (opts?.prefix) {
      const allKeys = await v(store);
      const keysToDelete = allKeys.filter((k3) => typeof k3 === "string" && k3.startsWith(opts.prefix));
      await w(keysToDelete, store);
    } else {
      await A(store);
    }
  },
  query: async (fn2, context, opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const rawEntries = await k(store);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);
    return fn2(formattedItems, context);
  },
  getSome: async (fn2, context, opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const rawEntries = await k(store);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);
    const selectedItems = fn2(formattedItems, context);
    if (!Array.isArray(selectedItems)) throw new Error("A fun\xE7\xE3o injetada em GET_SOME deve retornar um Array.");
    return selectedItems;
  },
  delSome: async (fn2, context, opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const rawEntries = await k(store);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);
    const selectedItems = fn2(formattedItems, context);
    if (!Array.isArray(selectedItems)) throw new Error("A fun\xE7\xE3o injetada em DEL_SOME deve retornar um Array.");
    const keysToDelete = selectedItems.map((item) => {
      if (!item || item._id === void 0) throw new Error("Os itens retornados em DEL_SOME precisam conter a propriedade '_id'.");
      return opts?.prefix && !item._id.startsWith(opts.prefix) ? `${opts.prefix}${item._id}` : item._id;
    });
    await w(keysToDelete, store);
  },
  setSome: async (selectFn, updateFn, context, opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const rawEntries = await k(store);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);
    const selectedItems = selectFn(formattedItems, context);
    if (!Array.isArray(selectedItems)) throw new Error("A fun\xE7\xE3o de sele\xE7\xE3o em SET_SOME deve retornar um Array.");
    const entriesToSet = selectedItems.map((item) => {
      if (!item || item._id === void 0) throw new Error("Os itens selecionados no SET_SOME precisam conter a propriedade '_id'.");
      const updatedItem = updateFn(item, context);
      const { key, cleanVal } = prepareForSave(void 0, updatedItem, opts?.prefix);
      return [
        key,
        cleanVal
      ];
    });
    await h(entriesToSet, store);
  },
  exportDB: async (opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const allEntries = await k(store);
    const filtered = opts?.prefix ? allEntries.filter(([k3]) => typeof k3 === "string" && k3.startsWith(opts.prefix)) : allEntries;
    return Object.fromEntries(filtered);
  },
  importDB: async (data, clearFirst = false, opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    if (clearFirst) await globalSwDbAPI.clear(opts);
    const entriesToImport = Object.entries(data).map(([k3, v2]) => {
      const { key, cleanVal } = prepareForSave(k3, v2, opts?.prefix);
      return [
        key,
        cleanVal
      ];
    });
    await h(entriesToImport, store);
  },
  backupToOpfs: async (key, fileName, opts) => {
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    const allEntries = await k(store);
    const filtered = opts?.prefix ? allEntries.filter(([k3]) => typeof k3 === "string" && k3.startsWith(opts.prefix)) : allEntries;
    const data = Object.fromEntries(filtered);
    const finalName = fileName || "backup.json";
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir("backup", rawKey, true);
    const fileHandle = await dir.getFileHandle(finalName, {
      create: true
    });
    const w2 = await fileHandle.createWritable();
    await w2.write(new Blob([
      JSON.stringify(data)
    ], {
      type: "application/json"
    }));
    await w2.close();
    return `${rawKey}/${finalName}`;
  },
  restoreFromOpfs: async (key, fileName, clearFirst = false, opts) => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir("backup", rawKey, false);
    const finalName = fileName.includes("/") ? fileName.split("/").pop() : fileName;
    const fileHandle = await dir.getFileHandle(finalName);
    const file = await fileHandle.getFile();
    const data = JSON.parse(await file.text());
    const store = getCustomStore(opts?.dbName, opts?.storeName);
    if (clearFirst) await globalSwDbAPI.clear(opts);
    const entriesToImport = Object.entries(data).map(([k3, v2]) => {
      const { key: key2, cleanVal } = prepareForSave(k3, v2, opts?.prefix);
      return [
        key2,
        cleanVal
      ];
    });
    await h(entriesToImport, store);
  }
};
var globalSwOpfsAPI = {
  ...globalSwDbAPI,
  listFiles: async (key, opts) => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, true);
    const filesList = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === "file") {
        const file = await handle.getFile();
        filesList.push({
          name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        });
      }
    }
    return filesList;
  },
  getFile: async (key, fileName, opts) => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false);
    const fileHandle = await dir.getFileHandle(fileName);
    return await fileHandle.getFile();
  },
  addFile: async (key, file, fileName, opts) => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, true);
    const fh = await dir.getFileHandle(fileName, {
      create: true
    });
    const w2 = await fh.createWritable();
    await w2.write(new Blob([
      await file.arrayBuffer()
    ]));
    await w2.close();
  },
  delFile: async (key, fileName, opts) => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false);
    await dir.removeEntry(fileName);
  },
  renFile: async (key, oldName, newName, opts) => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false);
    const oldFile = await dir.getFileHandle(oldName);
    const fileData = await oldFile.getFile();
    const newFile = await dir.getFileHandle(newName, {
      create: true
    });
    const w2 = await newFile.createWritable();
    await w2.write(new Blob([
      await fileData.arrayBuffer()
    ]));
    await w2.close();
    await dir.removeEntry(oldName);
  },
  mvFile: async (key, fileName, newKey, opts) => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false);
    const fileHandle = await dir.getFileHandle(fileName);
    const fileData = await fileHandle.getFile();
    const rawNewKey = opts?.prefix && !newKey.startsWith(opts.prefix) ? `${opts.prefix}${newKey}` : newKey;
    const targetDir = await getRecordDir(opts?.basePath, rawNewKey, true);
    const newFile = await targetDir.getFileHandle(fileName, {
      create: true
    });
    const w2 = await newFile.createWritable();
    await w2.write(new Blob([
      await fileData.arrayBuffer()
    ]));
    await w2.close();
    await dir.removeEntry(fileName);
  },
  zip: async (key, zipName, filesToZip, deleteOriginals = false, opts) => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false);
    const filesRecord = {};
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === "file" && (!filesToZip || filesToZip.includes(name))) {
        const f2 = await handle.getFile();
        filesRecord[name] = new Uint8Array(await f2.arrayBuffer());
      }
    }
    const zippedData = wt(filesRecord);
    const zipFileHandle = await dir.getFileHandle(zipName, {
      create: true
    });
    const w2 = await zipFileHandle.createWritable();
    await w2.write(new Blob([
      zippedData
    ]));
    await w2.close();
    if (deleteOriginals) {
      for (const name of Object.keys(filesRecord)) await dir.removeEntry(name);
    }
  },
  unzip: async (key, zipName, deleteZip = false, opts) => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false);
    const zipFileHandle = await dir.getFileHandle(zipName);
    const zipBuffer = new Uint8Array(await (await zipFileHandle.getFile()).arrayBuffer());
    const unzipped = Mt(zipBuffer);
    for (const [name, data] of Object.entries(unzipped)) {
      if (!name.includes("/")) {
        const fh = await dir.getFileHandle(name, {
          create: true
        });
        const w2 = await fh.createWritable();
        await w2.write(new Blob([
          data
        ]));
        await w2.close();
      }
    }
    if (deleteZip) await dir.removeEntry(zipName);
  },
  addZip: async (key, zipName, file, fileName, opts) => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false);
    const zipFileHandle = await dir.getFileHandle(zipName);
    const zipBuffer = new Uint8Array(await (await zipFileHandle.getFile()).arrayBuffer());
    const currentZipData = Mt(zipBuffer);
    currentZipData[fileName] = new Uint8Array(await file.arrayBuffer());
    const newZippedData = wt(currentZipData);
    const w2 = await zipFileHandle.createWritable();
    await w2.write(new Blob([
      newZippedData
    ]));
    await w2.close();
  },
  delZip: async (key, zipName, fileName, opts) => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false);
    const zipFileHandle = await dir.getFileHandle(zipName);
    const zipBuffer = new Uint8Array(await (await zipFileHandle.getFile()).arrayBuffer());
    const currentZipData = Mt(zipBuffer);
    delete currentZipData[fileName];
    const newZippedData = wt(currentZipData);
    const w2 = await zipFileHandle.createWritable();
    await w2.write(new Blob([
      newZippedData
    ]));
    await w2.close();
  }
};
function createScopedDb(dbName, storeName = "keyval", prefix = "") {
  const opts = {
    dbName,
    storeName,
    prefix
  };
  return {
    get: (key) => globalSwDbAPI.get(key, opts),
    set: (keyOrVal, val) => globalSwDbAPI.set(keyOrVal, val, opts),
    update: (key, updater) => globalSwDbAPI.update(key, updater, opts),
    patch: (key, patchOrFn, context) => globalSwDbAPI.patch(key, patchOrFn, context, opts),
    delete: (key) => globalSwDbAPI.delete(key, opts),
    getMany: (keys) => globalSwDbAPI.getMany(keys, opts),
    setMany: (entries) => globalSwDbAPI.setMany(entries, opts),
    deleteMany: (keys) => globalSwDbAPI.deleteMany(keys, opts),
    keys: () => globalSwDbAPI.keys(opts),
    values: () => globalSwDbAPI.values(opts),
    entries: () => globalSwDbAPI.entries(opts),
    clear: () => globalSwDbAPI.clear(opts),
    query: (fn2, context) => globalSwDbAPI.query(fn2, context, opts),
    getSome: (fn2, context) => globalSwDbAPI.getSome(fn2, context, opts),
    delSome: (fn2, context) => globalSwDbAPI.delSome(fn2, context, opts),
    setSome: (selectFn, updateFn, context) => globalSwDbAPI.setSome(selectFn, updateFn, context, opts),
    exportDB: () => globalSwDbAPI.exportDB(opts),
    importDB: (data, clearFirst = false) => globalSwDbAPI.importDB(data, clearFirst, opts),
    backupToOpfs: (key, fileName) => globalSwDbAPI.backupToOpfs(key, fileName, opts),
    restoreFromOpfs: (key, fileName, clearFirst = false) => globalSwDbAPI.restoreFromOpfs(key, fileName, clearFirst, opts),
    gerarId,
    gerarIdComPrefixo: () => prefix ? gerarIdComPrefixo(prefix) : gerarId()
  };
}
function createScopedOpfs(dbName, storeName = "keyval", prefix = "", basePath = "") {
  const opts = {
    dbName,
    storeName,
    prefix,
    basePath
  };
  return {
    ...createScopedDb(dbName, storeName, prefix),
    listFiles: (key) => globalSwOpfsAPI.listFiles(key, opts),
    getFile: (key, fileName) => globalSwOpfsAPI.getFile(key, fileName, opts),
    addFile: (key, file, fileName) => globalSwOpfsAPI.addFile(key, file, fileName, opts),
    delFile: (key, fileName) => globalSwOpfsAPI.delFile(key, fileName, opts),
    renFile: (key, oldName, newName) => globalSwOpfsAPI.renFile(key, oldName, newName, opts),
    mvFile: (key, fileName, newKey) => globalSwOpfsAPI.mvFile(key, fileName, newKey, opts),
    zip: (key, zipName, filesToZip, deleteOriginals = false) => globalSwOpfsAPI.zip(key, zipName, filesToZip, deleteOriginals, opts),
    unzip: (key, zipName, deleteZip = false) => globalSwOpfsAPI.unzip(key, zipName, deleteZip, opts),
    addZip: (key, zipName, file, fileName) => globalSwOpfsAPI.addZip(key, zipName, file, fileName, opts),
    delZip: (key, zipName, fileName) => globalSwOpfsAPI.delZip(key, zipName, fileName, opts)
  };
}
var db = Object.assign((dbName, storeName, prefix) => createScopedDb(dbName, storeName, prefix), globalSwDbAPI);
var opfs = Object.assign((dbName, storeName, prefix, basePath = "") => createScopedOpfs(dbName, storeName, prefix, basePath), globalSwOpfsAPI);

// src/utils/opfs_utils.ts
async function getBackupDir() {
  const root = await navigator.storage.getDirectory();
  return await root.getDirectoryHandle("backup", {
    create: true
  });
}
async function listOpfsFiles(dirHandle, path = "") {
  const dir = dirHandle || await getBackupDir();
  let files = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "file") {
      files.push(path ? `${path}/${name}` : name);
    } else if (handle.kind === "directory") {
      const subFiles = await listOpfsFiles(handle, path ? `${path}/${name}` : name);
      files = files.concat(subFiles);
    }
  }
  return files;
}

// example/sw.ts
var sw = self;
sw.addEventListener("install", (event) => {
  sw.skipWaiting();
});
sw.addEventListener("activate", (event) => {
  event.waitUntil(sw.clients.claim());
});
sw.addEventListener("message", async (event) => {
  if (event.data && event.data.type === "RUN_SW_DEMO") {
    try {
      const msgStore = db("LOCO_DATA", "messages", "MSG_");
      const insertedId = await msgStore.set("auto", {
        senderId: "system_sw",
        recipientId: "all",
        content: "Mensagem gravada diretamente pelo Service Worker!",
        status: "delivered",
        priority: 99,
        timestamp: Date.now()
      });
      const allMessages = await msgStore.values();
      const backupName = await msgStore.backupToOpfs("auto_backups", "sw_auto_backup.json");
      const opfsFiles = await listOpfsFiles();
      event.ports[0]?.postMessage({
        success: true,
        payload: {
          insertedId,
          totalMessages: allMessages.length,
          backupName,
          opfsFiles
        }
      });
    } catch (error) {
      event.ports[0]?.postMessage({
        success: false,
        error: error.message
      });
    }
  }
});
//# sourceMappingURL=sw.js.map
