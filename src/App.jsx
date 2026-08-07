import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabase";

/* ============================================================================
 * CAMPEONATO JPFFS
 * ----------------------------------------------------------------------------
 * A CLASSIFICAÇÃO NUNCA É ARMAZENADA. É função pura de
 *   (histórico consolidado da 20ª rodada) + (rodadas registradas no app).
 *
 * MODELO DE EQUIPE
 *   O goleiro é um jogador normal: mesma escala de estrela de todo mundo
 *   (a posição geral na classificação) e entra no sorteio junto com a linha,
 *   pesando igual no equilíbrio da equipe. A única regra estrutural é de
 *   composição — toda equipe sai com exatamente 1 goleiro + 4 de linha.
 * ==========================================================================*/

/* ============================ TOKENS VISUAIS ============================= */
const T = {
  fundoTopo: "#07204a", fundoBase: "#050f26",
  linhaPar: "rgba(255,255,255,0.035)", borda: "rgba(255,255,255,0.11)",
  ouro: "#F5C518", ouroClaro: "#FFDF6E", ouroFraco: "rgba(245,197,24,0.14)",
  texto: "#FFFFFF", secundario: "#B4C8EA", fraco: "#7A93C4",
  gk: "#4FA3FF", gkFraco: "rgba(79,163,255,0.18)",
  verde: "#3DD68C", vermelho: "#FF6B6B", laranja: "#FFA53D", roxo: "#C08CFF",
};
const FUNDO_APP = `linear-gradient(180deg, ${T.fundoTopo} 0%, #0a2557 42%, ${T.fundoBase} 100%)`;

/* Escudo oficial do JPFFS, embutido para o app funcionar 100% offline. */
const ESCUDO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGgAAAB4CAYAAAAeyrc6AAAwb0lEQVR42u2deZxdRZXHv1X3vr337iydhISQlYQtkMiigqwKA8iIiOOCMsoi4IKOggKyKCMiomJmUEdAZTMIElAgIAiyhS0hIWRfO0tn6SS9L2+598wfVfe9+7pfdxIIJCj1+dy8zrvvLlW/Ouf8zqlTVfDeLApwAWKx2L5KqeeVUq8Dk3i/7PHi5P9wnDOVUusBscdW4NvABCD5flPtIakZNGhQmVLqVyFgPHsE/58HnAPUAvr9pnuXgAFwXfcopdQCC0QO8B2NOA4C+PY7AdqBm4GJVuqUPd7TqsPZi3qcDgNTXl5eq5S6EchaALKQB0YAcTSiVF6igu9fAD4JJEL33Zvq6IQ60ADdVKlSvdZ5l3udCr0wADU1NRVa628opdaFVZougCHHHhWXU45P5IHSOi9NAVDdwO+BaSWepfdA/dxwu4bavqSUKyDqOM4djuP8XyQSOXiA3hxUSL0DL6zDLxyLxfbVWl+plFoTAiYH+G5Iar57SYVk1owUaRwlP/pelURc833oN2FpagV+CxwxQP12Z910qH5Ob4GIRqMTHce5xXGcGfX19f2Tmmg0empQCaWUB7wE/DdwLFC5AxXkhl7ACamQ8OGEXrRkQyilKCsrq4tGo2dprf+klGrvDYzWRo0BMmaUK0/cNUhk40hpX7qPtC0ZKbJ5lLz40BA5aGIkL0khacr1ut+TwJeBETvoOLtaN7eUVCqlOOigg1LxePxI13Wv0Fo/q5RKF6ReXwIMBsYB8WLj4zg/tS/dHapEcGwEHgW+D5xSWVk5etKkSdFeKnHXupZSKKUYOXJkdTwePzIajV6qtX5YKdXU69lZwNOq2NZ87oyEbH5tqHgrR0j3shHirx0p3tpRklm1j3hr9pHWxcPlonNSBdvk9AtUIFVPAJcDRwN1wfu9nfodc8wxbnV19chYLHaS67rf1VrP1FqvVUr1bt+0fafXrFBcDRwYupdCKfWo7/snW3WgAV8pRCu0gBbf3MlekFFKbdBarwZWa63XKKUaRaQpGo22dnR0tKdSqWxtba3f3t6umpubI2VlZeWZTKZSKTU0l8uNAMaIyDgRGQPUiUi4fl4goVqbdvLsN/uPcbnmq2WceXKCrKeIpxzWbvb45rUtdHULP7+umvFjXDIdPtG48OhTPVx1Uxtz38yajmj7te8jYsCit+oBmrXWq5RSy4CVruuuE5FN0Wi0paOjo726ujpTXl4u27ZtU52dnZGysrIy3/crPc8bJCLDRGSUiIz2fX+0iIwQkbw0aAVKIb7gieRVYNATuoBNViBuBe4H0lx99dVaa/1mCX0dHD6QczRZR+MFhrn3oZSSoHcopcRxHNFa5/9f6prQ/bNATimjxsI2BpAx+zhy82VlsnX2IJElQ8VfNkw6Fw2TX15bJYNqdf53leVabvhelbQvGS6ydoTI2uHSsahefvOjSpk83i26p+vkWV8gVVn7Lv3WL1y38P/7q59SiKPxXMfUr5/2DWuLDcBC4HtAHQAjRoyoUUptChpLWwB+8Fklt35FyZT9Cno/1KCeo8m5DllHk9WKrFIDvoAXaoQsmN9rZXyYoLF6X/fBQ1z59VVlsunpWpFFg0WWDJX0gqHy4K9qZOqBkSIVFlaBB0yIyL3TayS9fJjIumEi6+qldf4QuevmSjn+qGjRbwN6HryDVvhK4YXfdQeN69u6ZB1N1nXIug45ZX7vh8E6aCwy/dtKbrtc5b/r1a4bgBXAz4DRAKq8vHx8R0fHfBGJK4WIoBJRmPMzxf4joKlNsbQRXlwCzy8S5q0U1m0dgNgbMaaUChf7jy9QrNUsWXHhgLEOJx3ucsqHokyZ5FJWoUFpunrgqVez/OIPXTw1O2NtJ/h+r+frgkr84NQol345xSlHx0hUKECQTp/XF2f569NpZj2b4fVFHj1pKWFHCnUpVQRTh97PD5dhg+CwiYqPTFEccwgctB9EqiHTJIw4S2hqNvcPtcUma5P+bkFaoOLx+FHpdPoFEUEr03gThsM/rld4AhVJRTIOSit6srClVbFio7BwLbzZICzbIKzdAk2tQkf3zhvSaAQGVSn2rdccsJ/DYfs7TJngMG4fTWWFBleBKBq3C4+/mOO3D/bw4uvZPAjWlpTuJL3OH3ZghPM+neD042LU1yvDszwh1+azYq3HnIVZXl2QY/5Sj1XrfDZv80lndr4uqQQMrlaMqldMHAUHjVMcMlYxcSRU1wIxsXRAyLaCmxA+fKHwwgJjF71CPbZYgF4Gfgq85Pq+Xxt0CqVQCIyohVQcurPw1BsG3v3qFUNrYHgtjBqmOH6aEeKONLR1Kra1C1vbFdvbheYO6OiG7gzkPFAaohFFWRIqU5q6KhhUrRlUraiu0KQSChVRxlx6sK1FmLc8x8PP5Zj5TIa1G/0i6QwqFPS+QbXgurBxs/kuACYAas6CLHMWZLl2sOaME2N84qQoHzjApaJaMfFAl4kHaj57ZhS6fFpahabtPpu3C03NPi1tQken0JMRRMB1IBmDsiTUlENdFQyugkGVilS5QFKBa0Wix4d2aNwAK9YJ3RnhhCkKFYPR9fDCgj4SGtDzJJACcJVSAYsS20QMqzHIRhy45h5h3mqoTHmMGgST91UcPFoxeV/FmHrFkBrF4CoYNliDo0ItR+HpKtAZ9lMVznmeorVTaNzm8+ZKn2dfz/H0nByLVhe6laOtkg40euj7nAefOAVqquGGW4zay+WKJUhr87iNW3xuvbubW+/uZvxoh+OOiHDc4S5TJjqMHKKIphRV9Yqq4YpxgT4OdJnYv5X91FJQdp5AVqADNq/xWb5OeGOFMHepz7zlsHqDsL0NRg+D5XcbGPYZ3K9viQ1LJQHtikheggLCN6TKVD6dNSpPKWjthDc64Y01wr3PmJerKoNRgxVjhynGDleMGqKor1XUVCgqU4pYVOG6RoJEFBkPutLQ3AGbm4WGTT5L1gqLVvssX+fT3iXFnqK1MZ7fvx0AOPlYGDoYfnRLabXnhyQuUCnLVnssW+3xq3shmVCMH6U5YJzDpP00Y0YohtVpaiohlVBEXcHVgviQ9YRMGlo7fLa1QmOTz+oNwrJ1PssahFWNwrYWSto0MFqlTMGwugEBilqQHDebzVblK2xrPMjGDrI5aO823we9OOj8ng8tHdDSIcxf1dfIJmLG6Edchba/T+eEdMbctz/bEdhB3zfS0b8zaMhAMgGHHwRVtUbVNW3rY3gJ1y+4Z/AsEejqFuYt8Zi3pPiBrgPxmCIWNX+LQCYLmazQ1TPwu+V9Lil0ko4uSGegDKMWw21eAqA44LixWKymp6f4aTVl5iHdWejsKTyod6UDtqZC9kAsS+tOm6NIJ/XDkIJ7+37Be9xhGNiytSMOgaH1QBkc9yGY8VBB9Q1Uws8K6qFVodF8C2ZHl9DRNQBj1QVPU0IMNfz8oJ5dadOetUBNRbEW6AVQxALk6nQ6XdZbgqpS5u90xohkfyVoVM/2ds8v9Bil+jnsdcE1Oc/co1SP31EkEuCUj9jqCJx2YslK77BISGKDeogMUAdbD19MJ+l9XX+6uDttQEKguqwkEw2q5QYAuUqpyiDUEty7LG5eojMNPRneUq13tcF3tXi+UTsnHlWIARx3JKSS0NnVv5rbE3UITIPvQ3tXgZprbb5ThebVofBTDHC167rlFjoV9JpUrCCSWe+t9cq3PZKlDACljmjEqLEDxsP+Y8FLg5+B+n3hqKmGckej5rPUoffAcJ2yz2zrMo2dihm6XiQ3hb+01QuOzmaz8fCpqGsMPJB3PNUeGCgObECpI5M1nyccAZEU5ALVGoVTjjM0O502n6UO398DANnP9k7T2xNxiEVL/kxCKi7q0iv7JepCzA40t3UXerP3LolQoJo+eiiccAhs6wTtmEPZ0RftGKftrJMh1wVO1FByOuDsU6G7x3YqCdXaN8BU18ELs+HehwsuzrtVLzAuBsq0czxajEpoRDU/2utqrROeCV4pgHjEqBAwFHuPDNQrmLsCTpkG//1F45DngGgcdAS0C04MegSyGYjGbANkoX4ofPfyEqFaByiHh/8Az72655IQ2jrMO8XckIrrK2gFgJRS8TCK0YiVK6Cls7eKfOdL4LA3tcHXfw1PzoefXmgiBdu2WZBcIzWxlAEnXD3Jgbe1AE4uC/Ey6OiBSy+G3/5xz2aJbG83lCESkqCQCIVtUByIac/zigasog64OpAgefcRCnchDX95CU69EuavgPrawveuU9o2KmWIgGNrFR8CS1bD8Z8y4DjOnrGpQWm1Nkg7BU3VjwRFgIgWETf8i1jEVELE6ss9VMRSaceBZevh374Lt840Dl7E3YHtEFAOuHUw4z448nR4Zb4BzvPePbtTqjS325EfXSBjA/WXQu5ZiMUFYR0TCdizxfMMLe7JwKW/hPNugLZO853053QqaEvDty6HT18ELW3FQdQ9WTp6bO/Txt4PQPjyABV5BZEAIClEBfZ08X2ruhy4cxY88TJUJPsJjAroMnjlVbj5NwWV5nl7tg4SDtxaz3UAFZfHRgfXqlCAUKsCAdqbSs6DihQcdZBxonUollc0BtQFhx8Cw4fueWAG0l2uW0pmAvkiDsQ1hSyaPMUtKWt7uj72ZaZONOMqPZmCZESioBPg5eyYXwbKh8JHjiiQir0SI92voCkb0Y5opVR2IBa1t5SAeX30iAJJyOYgVQOr18LypeDUGTsT1PL0E/YeTRDWUDupEbNATjuOk+0vQBiL7CXgWPUWceEjU6DLjlHV1MGT/4APngHTToaHZ4I7yEQc/A449kioKDdSpvYSdRCPFNAqYUPD7nUP0KN93+8Ii1fWK0RYS3i6ewYgK8kHj4Wxw03srboCbvgVfPQc2LgFWtvg45+Hq64GJ2lUYl09fHhav+pkj5SyhAXID7FK6aPisKbH05h5NPkz6axpAKXMsMPeZH8+MgVqak3I/uzL4bs/txY1GHDT8MOfwSn/ARuaQNXBx47Zu+xpKmEpgB8ayukrQSE7pXVzGLuuTGE0sDyp+qi9PeILWVXwH8fDS/PhhIvhwaetPpfiEVnXhceehiNPheceg3M+Yehsbi9Rc5WpgnyUiHX6oc8skNUi0mTxEaxzmrGiV122dzAdEThoDDz/Bhx7MaxYb8DJeX0JQC5nfJ91G+HYM+Cuh+BDHygmGnuy1Faa4VgvRz6vQYrVWgBQD5B2tdabvJCz0JUuDHNXp9jjEhQY0jWb4Ou3FEAbKOcgiD54Plx8JVRV9GuU3z1H1bZhnU3I6c6YiEgvhPwQUD1AxhWRDeEfdaZNOEKA2vLC2Ptb6fkq5N2HQQ6fK+UEhNPRgtLWWZwPsDMugKPNs1vaipNCdobjlgIzsHOqRCfaURsFdRlcbR7Q2VMY/i4hQcFUoIwbiUTW5XI5BLRSpme22IhrdRkk4+ZmuzrGP1Bv3dme7DjFkQCRtybNwbu/nUHHIJ+uv8hE0BlKvV/QybUupFu1dIZsUOGanKUQWaATyLjAeqWULyI6qEhTq7mmMmVSsDp7ikb9dlhcBw7aT+M6ppGXrxe2tpqroxE4aKyTj5gbu2D1sg/prNDeBes2enn/JfidCOw30mHoYKfYt8n/IYXsCw3tHcKCJVlEoH6wZr+Rjok2KPpNnFPKDKm/vsQ+n0JkfXCN4qiDFWNHKMrjQkcPrNkovLJQaNhY3Bn6ICSmPesqzd9bWyiqX0iCFCY/2wCUSCQae3p62oAqbUaG1cZmy9njJst03VZ2CqHgYeUJePAHEWoqFGXlis9dl+Huv3lWxBWP/yJBMqnxAR8zU0zl52IosqJobPKZfk8Pv5nRbZIMtSEA37mwjAsuKCfdLDiuSfBXupAHpRB8T4gl4eWXMxxxhpmK8alT4/z8JxV4TR6OI3g5091VPq3XZI46EWHTZp/xp3bS3in5qPk1F0S46GyH2iox6b/YKWC+0Nku3D3L51u/MBMIeoMU/H9wdYF4NW4ruBBesQRh1Vs7kNWjR4/eopTabJEWMICImEjCyEG77kcIJqeuJwOZdHHqroj5vidjcgeirqIsYY7ypPmMODBulMOvb6zg+xen8H2rf4FsFqRH6O4RPF+IpTTR0BFJaWIpDSlNIqGKAq3BddksOEmFk1To0OEkFSSVSeZXBYr/P5dFuerbEWoSFGbyZAoBmYSC8z+vmPnfiqjbd6p28PfIIYqIfaeGzX2YpW8PZaWnDfDcuXPnZpVSa4EJIgaghi2F0MqYoUZ0dpWiqgHmCQXfxaLwyHNZGjb7RCKKSEQxcpjD0dMipDOQ3uJx5cUpHnoqzfwlucJ9xVy7fqPHY093mSQSW0WFIL4QiSlWrc7lU4mV2GFKF9o7hfvv77EqrMBIRMBxhJY2yduaDxygufAzLj0bhVgM/vqMz31/89jWIgytVXz5dMWRB0LHWjj+I/CZk+B3jxbcgHB9x47AjJP6sLKxb7A+BFCHBUhcEUFrvQw4MdDgDU2GBkZcGDfsnaHavg+JmOKWP6Z5Zk7xSNrnT4vxmx+U09kDkZjitONieYACEU3EFUtW5Pjqlc07tIe+B2KBcF3Y3uJzwfc7d0gKAE443EEciCXh6Zd8Trs0W6Qr7n0Cls5w2Gc/wIULTjMAlWqviaNs82dh5YY+7ZoLyWdrEOFxDcJqUfjH67cZllGehDH175wPIQIVKZUnE55nevudf0lzyecSHDwxgngwcrhT8tpo1CS3Bxmavc/n+qFtjgNV5ZqejITshYSuK6ileKwgnZXlZo5TkKsdcY0qv+52nxM/qOhogRXriqMf4babNMqG0zphVWMfgLJBXBhoLgLIcZxFuVwOETO6ur0DGrfDiDrYp05RWy5sa9896bQlg08SSrz3g8or41uo/n2STEZKTl/sLUGlHNmWdn+HFB/g9SU+WkN3Fxw2WfHy76Pc8bDHk6/4LFol+AK/fVj47cPSr6r3xWTwjB1hRkI3bTexwl4+UMYC1ANss3bIAKS1XqaU6haRhKMRz0et2AiHTzDO6ph63hGAlILObjH+hV9omK9/LsEB411aO4REBSxZmetDW9Np2Hcfl0svKEfbmc8BE4vEYPnKLA8+2lNsA+0AX2W54rILEuRyYpP5JZ9ps71ZuP3PGXwbjXj0eY/XXvWZ+gFN92Zh0r6Kn3zHQTo0KzYIL73p8+iLwqwXhZYOI1Xh6TVBm+1bD8PtnKAVjYYkBfYxJEF2PJit9tMA9J3vfGfTddddtwqYbNmuenOt6b7xGBw4SvHKMjuHdTfG2Lp6hMu/GOcLpwuua541arjDgRMitHcIqYRi+zafBx5PF3cODT1pYdy+LjdfV23D2dYb9AQq4YmZXQYgXZy3mfOgukJzw3dT1m+Sghcbhw1LPX73YMbQd8tGP3lZmj/dFGXaFA09gtdqpHrccMW4/TSf/7iwpkG46n997nqCIpUbtNlBYxSRlHmHN1ZKvg18L+//5DDJiq1Ak/WFzDIn1157rec4znzP8yaLmKSgBQ0maBqNwKFj4La/9eMlq7dGIpQyPe2Yw1wicYVCIQp8X9GTFWoqNTkU517RxrqNHtGIIpOVvuETT0LTBwTxBJXrf1ZeXq30nlRvV0sIx/jEN2ShoVE45tw0nznF4TMf00yboCivCoKXkOmBfQfDnT9WOI7w+8f6TA7mA5MKwwxzlvZ5pQz5ZCyaLUA+oPKrLimlXgI+E4jc4nUmL25QJRw0WuFoKXpgEAB4OypPKWjvEqTbTpMEsr7QmYY3X85y0+3dvDA3a3ukFAXlk3HFgmVZfvjLdhxHmfcQo66cCDQ2eraRpQiZiAtbm32++aNOslnJRxXEqrj2dsmrHQkZ++403Pagx20PeuwzVPGBSYqPHKo4cRpMGAPZdjN3+KavwMznTIpveMLz4fsbUcp1Ca+vKMQoQwAF3abJ2iACCRKASCTyiud5iIijgE0tsHqzCU3sNxRGDobVmwp6MyA+8aiZEd7cXpzxsEOa7UEqqbjkJ908MyeH6yqyOaE7Da3tQkdXSA34pvGKGjoCG5t8Hny0e6eClMF1WkNnl/DHv+446c91YGidoqZSMaQGXl0otHUK6zaZ44G/Gw1zxRcVV31Z4XVA3WCYOgGemmMydHMeDKqCyaNNb163GVauL0hoME5qpacbs1ZCCwVtbszK6NGjF9oVR5TjGLs5d5XgKBNDmjpWFbGbA0bCUz9UvHKzw2PXOSRiBjzHTrkP2JMI9KRLqxmtYU2jsHytz+JVHivW+mzY7NPRJfnwTn/0Xqw0OI4By3EKh+sMPMSttekcjmPnDIWuc5xC1HtonWL+jATz7o7zxN0xjpumrf9GPrc6l4Mf3yl0tdpJzxpqK4t9qcMmKqprTGvPXWZGrZ1C4qVYCdLWOW0MKHYAkAB68eLFHVrr1yhEmZi9xHrhwIcnF0tHxIWj9leMqINxw81s74CNDa6C2grTe7KemdHdX4lFTYNFIoWJvcFaBzvyvcROQex9BNMqBxyl7fX78Gcws33jVmFjkyAO5Frhv85xcB2j7rI5w8R8gY8doUhU2nEoH5p6+c7HHqryS/g9+0afEE/GEgQFbLcA5ePcQT/TdhrkM1b0BOC15cZhzXlwxARVRCGXboDljfb/Ard8RXPswYqjD1Tc8GXzNhHXgLOoQfpVe/nJw35hXEX2gjwpx05Svm1mFl2hSLfDkVM0T94a4d+P1RwyXnHEAYrLPq+540qNnwYdhw3r4ZUlBRKkFBx7qLEufjc8N1962590KBa3xaq4gPbk1wQVSxSetnbVUQrWboUlG+AD48xKI5NHKuatEiKuGXm96xnhx19SrN8Kh45VzLzaRSzl7egR6odofnRPltYOKYpNhSfe7ioYwWRf8Qdman2uk4KE7Ey2qecbab71/hxnHu/wwQ87ZDYLxxyqOWaqwusSo+6jgt8pxkYm4Vv/C53dBX9ozHBDsRFYvQEWru5jf7pDDup6SxIIq7j8UOu4cePeVEqtBpSj8UXMAkrB8ifHHxwytgp+9pDwq0eEQZXmfMTOzkvEFFUpxY135bh5Rs7YEin4BTWViroqRbxKlcpPHrCUpRRujSZSo6ks3/kIbiKmcGsUsWpFTZXaIZEJ5in1pOG0b2SY8WCOSBIztdcBpxyTnKtMLnhjC3zxe8KMvxfyKBRwwjRFrMJc89wbQiZrZ48U2j0T8n8arJojzOICCXIXLVqUcRzn757njQ78ob/PFy79uEIJnDBF8dMHhZxNAM/m4Cv/4zPjOcUJUxTD6owdatgCs14TXlvq56fdBw2yvU047/oeOz9GMWext1OxvkBafvvHLl6YY1jphk3+Dn2w4LpZ/8jQdn4rftYwxExOdnhtMFDY3CZ8+jsZbtxfcfwHNBP2UVQlTWNv2CbMWSI8Pltobg8RG0sCTvugznv3j73Uh+X2WPsTtZLTEEQQSo2+uQDRaPQMzBTQHCDJGPLGdC3NMxzZeJcjY+vtGpuKUmueFR16gHPvpcOuPrnD3wVr3gVtMqQGaX3cFZntSOssRwZX92mzrcBqYA3wG+CA3p5KmIx6APF4/FmlVLOA42ikKw3PLxQijlng4mNTVZ6qBr0smPHm6MLfYbVWyr8Ijl0dZ9K6cK3j7MJ16q1dlycy0uvZukDNg3rk44k2seRjRygq6owCe36BsKW5oP4opPfa6c+sBjb3ee9eronT1ta2HXiawvRbHnnN8sEcnHa4NjMI/GI1Eqy0Efw9kMrK7QaSkPN2bWpJeFr/W52S0ns1kv7ITuDIn328VW8OzHxO8h0lxN6CAOlWYGXIQZVSAAWipZRSDwDKt+z4uYXC2iYh58FhYxWTRpnQin5/V4SSkur7MHKo4phDFWShsxkenS29bW13iKCtt2ouS4kZdvRSc5JKpR5XSjWLGDXX1gV/n28857I4fPJDqndveL+EVDDAWccpklUKceGZucKGpiK1L5YMaDvus9KCxEAqLq/m2tvbt2mtHw+ruQdeFHzf+D9nHKlNmMN7j+9W8Q4UzzdAfP6jGtKCcuCev/Wr3hyr3paFA6QDARRmEHcDyvPNfV9YJCxeZx40YQSccEgxWXi/2NibwAcPUhw8ySwZumUjPGLVW8hud4Y0VgOw3ILWJ7mtVPN6APX19U/ZbB/tOPiZHDw4W0jGzIPOOUG/I8kk7/UiwAVnaCMbCfjzsz6tHYWlDazN6Qqxt6XA2n5VZj/PcNevX9+ttb7XGjYf4L7nhNZOEyw87hDN/iPfJwu9ycGIIYqPH6OhCyQDt/9VerudXRRSfDcBi0LqTXYGoHzoJ5FI/F4plfMFR2tYuRGemm+kKBWHL31UF6J675MDBDjvdE1ZNUgUXpovvLpI8kuC2tJh2z2DWcR8WSn2tjMA6Y6OjsWYRbaxK6lz+998OxIKn/ywZki1deL+hVEKnNTyFHz5dI3fCSoKt86U3nY6E3JOWzDbAKwbEPgdndNa/68lCygFz7whzF1hItr1NXDuSTqUBP+vSw5E4JyTHYaNMtH8tauFPz/tF0UYMANxQZinAXjTBklLqrcdAZQD1CGHHPKo3QlEOxo/58H/Pe6TjJmFgc79qENVWWGQ613tuf305j0hPfEofOPTRnp0Cn79kE9nTwE8S766bMyz00rPChjYSuzIvDtz5szJKqWmWykSpeCB54Wl641uHT0Ezj3JecfJQu8870Dn697f9XqPXZm49Xak57MnO4wdrxEPmjfD/z3UR3o6QuRgIzDfkoR+pWdnAPIwG3DcqZTaYtK48Tt74DeP+VQkjRR95VRtpMh/Z3pw0PASsnW+XVTWD62Y5vsQi6qihczzgU71znQa3zfpwZef45hBvAoDTlPfwGiHtT1pYLGVoMyOONaOABLAaW1tbQF+BSjfx1cK/vCkz4qN5umjhyouPNUpasDdWYJEjYpkAZAvfjzGqw/XcOt1FUQjJn7/7fOTzHm8ipsvS+QXIq+rgvGj1DuyMFQwq+5LpzmMHa+QHLRthV/c55nOUeyYBokhm4HXB/J9drkDAyqVSg1WSjUDvuOYfXEuOV1L9tGIbJkRlbV3R6W+Ru302MnOHHZbMznjSCUv/Dwib9wRlxOnOaIUsubxKjl6akQWzBokp58Yl+pKLdvmDpLDDnSl4ckKmbK/IxNGKXlzRlReuMORH56nRIXuyW4aI6osQzY8EpPc7JjIGzH58SVOfk8jivcFWgOsAm4HDtuVxt9hBwZ0Z2fnFszWXcr38ZSCO57wWbzWjM0PrYFvf8rZrYwuiFJ84981V/8ux2/+6vG1syK4rsLRitmvZ3llfpapB0bYf6xL03afOQtytHcKleWKYYMU6zbDt27yOO80u0SMv3v8tkB6/uuzLsNGKcSH7ZuFn95TUnrSVr1tA+ZYcsDOuJA7a9bFStHPgGYRHK2Qzh74yZ+MLdrWCud+zOHA0SofMNxdAP37DzyenCccNVnz8iKPbFZwNFRXKho2eFRXairKFK02m6y6QtHWLgypUYzfT3H/jQ7fnG6CvY5++4srBVP89x2m+MbnXbItglsJN93psWV7n6h1m21nzzqlc+13A5KDXQXIB5yOjo4m13VvDqRIa7j3GZ8XFwmpuFmt8QfnujvXNXahpza3w/FTNKMGww13ZlEKXlmY49qvpjjm8ChLVuZYuipH/SDNdy9K0NFtsk5/dUWUAz6Z4Q8P+0ydoHYbDQ/Ix48viVBWodARxerlwi1/8nonW3aEpGcr8IqNve10AGZX+rkH6MrKyl8opTaI2S3Iz3nw/T/kcF2zG8oph2s+ebQ2643uJilyNPzwPx1iEXhyepJzT4vype93UF6meW1+ljv+1M3qdT5X/LSDQ6dE+OL3uti0TVjaIPzoaw6fOFazdsvu6zCeBycdofnUvzmkWwQnCd/9nxydxROIg5lywbT6hZj9aZt3Vnre0vvZ6MKX7ANyQaLEbd9yJf1YTLb+OSZLfxeT6nIlWg2cVLIzhhiQsjhy+3+5cu25ETnlKEfqqrSgnNB06/ChBMwujTWVSq66wJVzT1U7THDZ2fdxNJKIIYvvj0vu1YTIvLg8OT1alDRij2ZLCtZZYC6ksGnwO+pOa8BRSr2GydzJKYUMr1Oy7t6YbL4/Jtkn4vLziyO9t2x+20CZQxedS6XiUl8/VOrr66WsLNHrWme3ZvcEdbn+oojIoqT0PJ+QnpfjMmk/VcQ6rcQ02GMFJmNnyrsBTl6KXNf9UG8p+vIpjuSeiMmG++LSPSshx07RpXrWW6PcColFTYPH43E555xzZObMmbJ69Wppa22VtrY2aWhokEcffUTOP/88KS8vFzDX7I5OEtRh6iQt2TlJ6X4+IbIoIdec5/am1YJJ4V1tpecZ4PPYPenereC/Y4yluh2bQ2c3jZW/Xh+Rrkfj0vJwXBbcFpeKpJLwzvVvuYEcA85JJ50kb775puyorFixQs4888yia9+uaotGkNfvjYs3Nyne3ITMvzcmsWh+w9zg910WnLU2YvATYPy7CU6g5nRZWdkguwiGp7VJOBk/QknTn+Oy+YG45J5MyPSvR9+2qgsa+OKLL84DkM1mJZfLiR8CxReRXC4n2Ww2/90VV1zxtkEK3v3Gr0VFlqSk+/mk5OYm5PAD+miIcIZOA/AX4FRM5ui7H2W3hOGzgd4NXvSCUx3xn4rLhj/FJftkUj5xtFNKDewSOGeddZaIiHieJ7lcziLiS+OnPy1rjjxS1hx5pKw/7TTxurrM70JAXXjhhW8ZpOCdTzzCEVlQJl3PJ0WWJOW6C9xSHW97iBjMAb4DDH23paeUqns4b4/sC//p6qikn0hI08yEND6QkNH1fQzpToR6tCilpL6+XrZv3y6+74vneSK+nwdo1ciRsghkEciyigrx2try5wIwe3p6ZPz48aKUyu8vvrN2TylkcI2SDX9LSvbVlMj8lMz+XTy8F3h4Edg1VrWtAG4Dpu2iK/O2/KB+IwzxePwrSqntgBIbTP3qL7NsaDIef1W54vbLYkTcoi1Ud8Jj14gI3/zmN6mursbL5dC+j+Ry+UOVlaEdxxzl5Yjn5c9p30d8n1gsxhVXXGH2wd7Jhwdrw4nA738QZ9gwjeeZZWS+cHU6v9pjKFq9LeTbrAGewuQb+OzhrIBA1X2mt6o74TAtPU8YCfKfScnPLtl5exTsMJ9MJmXdunXi+36RvQnK6smTZQnIEpAVw4f3Oe+LiO/70tLSInV1dUX3HtDuuHbT+YuiIsvKpfO5lMjiMvnsx0qytrBqmwdcDYzaHarN3Q0AeYDr+/49SqmTReRznk/OdXCfnONz9e+y3HB+lMZtwtfPirBgtc/tj+SKJnT1Jz2e5zF58mRGjBhhhnibmth+/fWFgScRvMbGwsqOLS1s/spXUJFIvlvXfOtbuKNGUVlZydSpU5k1a1b+3v02it2I46wTXa78apzOJp/UEMX032a4e1afd++2EYNgrGce8DcKmaJ7RWKasuqyIhjGVeAFknLv92OSezolm2YmpeOJlBx9sLNDSXJd01PPPvtsY/RFJL10ad7eBMfSXkf43EKQrhdfFM9K0SWXXFJ074FIwaETHel4rVy6Xy4TWVgu/7gtIa7bx+7krNQErO0J4D8we9nuFmKwuwapg+BfG/BZICcgnm9mRF5wU5rXl3tUJBWZHNxzTZyxIzQ5b8fxumQytMWe4+Amk7jRKG4shhuNFhs0pcy50PlAmpRSxffqL0rtwbBBigdvSRJ3IRJVrF3vc/ZlPfltB0LJmttCw9hN1u48a4OkandIz+7MIvCsynwZuBRwRPBQZmvKT1+TZlubWTiiqgweuD5OXVX/QxPB3q7bt28vdEXPw+vqwstk8NJpvEymOLVVxJwLnw+psuBe/Q6r+1CWVDz0yxQjh2tyWejJwSe+0c2mrYbwhCLVrXasx7GfLwGPY2Zp7zbV5u5mVZez95wOTAW+4PvkHAd3ZaNw9jU9PHZTgu40TByluf+HCf7t2910dkvvhYXyAC1ZsgTP83AcB3f4cPZ5/PEiG7T5/PPJrjOpZU5NDcNuuw2VSOSBi06cmNczCxcuLLp3mLEh4Lhw/81Jpk5x6GoWkuWKT13UxZzFfim702zByWLSp/5qIwd7fTJ0sINhzEqTALnA3pzxYVfST6dk01/KxHuuXP7yk4RE3dLTDAO/Zd68ecYH8vvyuNWTJhVY3LBhfc4H9qehoUHi8bgopYpYnFIF32zGTUmRFVXSMbtCZGmlnH9myYBvxvo6gd15EvgCUMV7qARKa4QdjxdCpOELJ7uSe7ZcNv2lTPwXyuW+6xPiOn1BCoz5BRdcYMI7mYxILid+NiuSy4lks7J68mRZ6rqy1HVl5YgR4rW0FP0mk8mIiMiVV17ZhyCEwfndfydFVlZJ++wKkRWVctm50SK6TWEqzoZQrO0VGy0YwXuwBDNBp1kd7YVBuugTEfGftyC9WCEzfpjM91StiyUoGo3KnDlz8jG4cCRhZX29LLSMbVkiURRJCEI9K1eulPLy8nxkIogSBJ3h9utTIqtqpG12pcjKKrnu4lh/LHNTCJw3gB8Dk3kPp6cHNu7jIVrqBxX/2lkR8V8ol02PlIs/u1IeuCEp8WhxeD8IzUyYMEG2bt0qIiKZTEZ83xfxfWmePl22Xn21bL36atl+003ip9Pi+35ecjo7O2XatGlF9wo6gFbInTeWiayukbaXqkRWVcn1X4vnwVHF4Gy1zmgQpf41cMQ7YMf3GEjnhQaz8iBdfGZUci9UyObHysWbXSmzfpGSipQq8kmChp0yZYqsWLGiKKLdO5qdDQKpItLY2CjHHHNMUaA0AD4eVfLn6eUiq2ul/ZVqkVXVcu3FIXBUyUjBWpv4cTdwImYpi3+KEoD07VIgnXtqRNLPV8jWxysk92KlzL69TIYN0kVqJmjg2tpamT59urQFqqxE6e7uljvuuENGjBhRdG1wr5pKJX+/s1JkVZ10vFYjsrJGvvOlfsFpCYGzEvgzcEbIGX3HGde7CVLOxqmusX87roPKeXDmsRF+9/2ESUSPaRo2+5x1eSdvLPdwXRN60VrjW0dk1KhRnHzyyRx++OEMHz4cgE2bNvHqq68ya9Ysli9fbn1bB88r3GPsSIc/31rBgRNcuts94knFhVd18Jv70rh25eHwnh5Wehz7vouBe4BHQ8kf/zRFhSTpB6Uk6Zgpjmx8tEI6/1El7c9WSdPfq+XkD0Xy6k4pQxx2ZlzHcRxLqQuSc/S0iDS+VCf+0kGSebNOOubXyhnH9xvAbQsRglXAY8C5wGD+iYsKsbtrShGH/fd15I17yiX7UpU0/6Na0q/Vytc+m+iTDqy1Ftd1xXEc0VqL1locxxHXdYvIQKCu/vOshHQvHizphYNElg+Stc/WyOEHuf2B0/qvCE4pkC4P+Rd5kGorlfz152Uir9fItn/UiCwYJP93Xbkk4mqnhysKtgv52VUVImuHSuf8wSINQ+TF+6pkZL3u714tFpyGf0VwSoF0UdgRdEIU+KffTIrMq5XmF2pFFg6Wl2bUyP5j3CKVR4kEj6DRRw135Ok/1oqsq5fOBUNE1g2VO35cIfGY6m8IPszW/mXBKeXMftrGtwTIhRMezzktJttfqJWeuYOlZ/4Q2fryEPnM6Yk+wwP0Su86/cS4NL42VGTVMMkuGyo9S4fI17+Y7KMqKSR7NPVia4/8q4PTG6QTMHNnBMgqVWj8A8a5MvveapElQ6R97hDxlw+TW39YJeWpgsoLpCYWVXLjFZXiNQyXnqXDRNYOk4V/GyRHTonkQewleZ6NEIT9nAeAzwCDeL8UgXQAsCDE8Ioa/qbLyiW3aKh0LagXWT1cFjwxRI7/UDzf2EceFpNXHhkismEfSS8bLrJuuPz2x1VSUdav7cr0iq0tBu6yfk7V3mIL9iaQPKtSbgf+zaoepTUqGIc59dgYt1xdyeiRETI5M7Pg9vs66UnD+Z9LEdWgtbB5q8el17Zw70NmUaneK8FblbqVworvLcBs4H772fG+3PQfBY8APw319FxY5Q2p1XLXz6tFGvaR9Ip9RNaPFGkcJelV+4hsHCkP314n+45wBiITYabWYKPSN9rYWvx9GHZeqv/TMqvAXyoiBf/x8aQ0vDxMZNMokU37yub5w+X8z6VKEoiQvdnSi6k9ben+5H+GwOe7CZIODVe8FGJbXpArDcjgOi0/v7Zafn1jjYwc7uQZWol5st2YTJvA3iwFHgS+DIzk/RVt3pbKq8MMo/v9SdMAUhOotDUUMj/nYaaEnAbUvhfY095ahMKqhLMw66pNBarBrOutFMpxCjsE91orNWuJQFuIhKyx95phJbPtfYDePkiB+nkDkxQ4FJhkv/dE0CJ9sjXarfOZtbalw0rOA8BMYAmFbWHeB2g32qYtmHB/E3AIJlkyXHJWalpDKnKjJQMzMLlrwf4IvA/QOwNSxqqn560NGWPr0m7ByVip6cZM3n3Y+jevU1iOkvcBeueBWo9Je1oasiVl9lwjJsvzT9bmNFDYK/s96XO8V0ESzAy2/YGPAAdbIF4DnsPkimfeyxXknwQkhQlujrJ0fA2FtUB3S570nij/D1vgMeCS4cmnAAAAAElFTkSuQmCC";

/* Escudo oficial do JPFFS, embutido para o app funcionar 100% offline. */
const AMARELO = { cor: "AMARELO", chave: "amarelo", emoji: "🟡", hex: "#F5C518" };
const AZUL = { cor: "AZUL", chave: "azul", emoji: "🔵", hex: "#4FA3FF" };
const corDe = (c) => (c === "azul" ? AZUL : AMARELO);

/* ============================ MÓDULOS PUROS ============================== */

const CONFIG_PADRAO = {
  // Art. 31º §1º — P = J + 3V + E + P⁺ − P⁻
  pontosPresenca: 1, pontosVitoria: 3, pontosEmpate: 1, pontosDerrota: 0,
  tetoPorRodada: 4, baseAproveitamento: "realizadas", rodadasPrevistas: 30,
  // Art. 34º §8º/§9º — atrasos
  amareloNoSegundoAtraso: true, pontoPerdidoTerceiroAtraso: 1,
  atrasosParaSuspensao: 4, perdePontoNoQuartoAtraso: false,
  // Art. 82º — cartões
  cartoesPorPonto: 3, pontosPorCicloAmarelo: 1, pontosPorVermelho: 1,
  converterSegundoAmarelo: true,
  // Art. 34º — formação: goleiro é jogador normal, 1 goleiro + 4 de linha
  jogadoresPorTime: 5, goleirosPorTime: 1,
  // Supercopa: N melhores de LINHA + os 2 melhores goleiros classificam. As
  // vagas de linha incluem os 2 campeões da Copa Hendor de Penalidades (se já
  // estiverem no N, não muda nada; senão, entram e empurram os últimos).
  zonaSupercopa: 12, goleirosSupercopa: 2, campeoesHendor: [],
  criteriosDesempate: ["pontos", "vitorias", "saldo", "golsPro", "cartoes", "alfabetica"],
  // motor de sorteio (§12º) — busca local otimiza direto a divisão exibida
  rodadasAntiRepeticao: 3, usarAproveitamento: false,
  pesos: { rigida: 100000, amplitude: 1000, desvio: 300, faixa: 40, varianciaInterna: 60, repeticao: 8, aproveitamento: 15 },
};

const ROTULO_CRITERIO = {
  pontos: "Pontos", vitorias: "Vitórias", saldo: "Saldo de gols",
  golsPro: "Gols pró", cartoes: "Menos cartões", alfabetica: "Ordem alfabética",
};

/* --- core/aleatorio ------------------------------------------------------*/
function hashSeed(t) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function criarRng(seed) {
  let a = hashSeed(String(seed));
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function novaSeed() {
  const al = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => al[Math.floor(Math.random() * al.length)]).join("");
}
function embaralharRng(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* --- core/estrelas -------------------------------------------------------*/
function estrelasPorPosicao(p) {
  if (p <= 3) return 5; if (p <= 6) return 4; if (p <= 9) return 3; if (p <= 14) return 2; return 1;
}

/* --- core/disciplina -----------------------------------------------------*/
const NIVEL_ATRASO = {
  1: { rotulo: "1º atraso — alerta", curto: "1º", cor: "#FFD166" },
  2: { rotulo: "2º atraso — cartão amarelo", curto: "2º", cor: "#FFA53D" },
  3: { rotulo: "3º atraso — perde o ponto de presença", curto: "3º", cor: "#FF8A5B" },
  4: { rotulo: "4º atraso — suspenso da rodada", curto: "4º", cor: "#FF6B6B" },
};
const nivelInfo = (n, cfg = CONFIG_PADRAO) =>
  n <= 0 ? null : { ...NIVEL_ATRASO[Math.min(n, 4)], n, suspende: n >= cfg.atrasosParaSuspensao };
const mesDe = (data) => String(data || "").slice(0, 7);

/**
 * Art. 34º §8º/§9º — contagem mensal, que só atravessa a virada se houver
 * emenda (nenhuma presença pontual entre um mês e outro).
 *
 * `contador` é o nível de punição vigente; `contadorMes` é só os atrasos
 * ocorridos DENTRO do mês corrente. Chegar na hora não apaga os atrasos já
 * registrados neste mesmo mês — só perdoa o que veio de meses anteriores:
 * o contador regride para `contadorMes` (nunca direto para zero, a menos
 * que o mês corrente ainda não tenha nenhum atraso).
 */
function disciplinaAtrasos(base) {
  const estado = {}, porRodada = {}, antesDe = {};
  const rodadas = [...base.rodadas].sort((a, b) => (a.data || "").localeCompare(b.data || "") || a.numero - b.numero);
  for (const r of rodadas) {
    const mes = mesDe(r.data);
    porRodada[r.id] = {};
    antesDe[r.id] = JSON.parse(JSON.stringify(estado));
    for (const [jid, status] of Object.entries(r.presencas || {})) {
      if (status !== "presente" && status !== "atrasado") continue;
      const e = (estado[jid] = estado[jid] || { contador: 0, contadorMes: 0, mes: null, emenda: false });
      if (e.mes && mes !== e.mes) {
        // Mês novo: a contagem do mês zera sempre; o nível de punição só
        // continua (carryover) se a sequência de atrasos não foi
        // interrompida por uma presença pontual (emenda).
        e.contadorMes = 0;
        if (!e.emenda) e.contador = 0;
      }
      e.mes = mes;
      if (status === "atrasado") {
        e.contadorMes += 1; e.contador += 1; e.emenda = true;
        porRodada[r.id][jid] = e.contador;
      } else {
        // Chegou na hora: esquece o que veio de meses anteriores, mas
        // mantém contando os atrasos já registrados neste mesmo mês.
        e.contador = e.contadorMes; e.emenda = false;
      }
    }
  }
  return { porRodada, antesDe, estado };
}

function nivelSeAtrasar(disciplina, rodada, jid) {
  const e = disciplina.antesDe[rodada.id]?.[jid] || { contador: 0, mes: null, emenda: false };
  const mes = mesDe(rodada.data);
  let c = e.contador;
  if (e.mes && mes !== e.mes && !e.emenda) c = 0;
  return c + 1;
}

/* --- core/pontuacao ------------------------------------------------------*/
const evVazio = { gols: 0, assistencias: 0, ca: 0, cv: 0, cz: 0 };
const eventoDe = (jogo, jid) => ({ ...evVazio, ...((jogo.eventos || {})[jid] || {}) });
const timePorId = (r, tid) => (r.times || []).find((t) => t.id === tid);
const idsDoTime = (t) => (t?.jogadores || []).map((j) => j.jogadorId);
const HIST_ZERO = { P: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, CA: 0, CV: 0, CZ: 0, Pmais: 0, Pmenos: 0, gols: 0, assistencias: 0 };

/** Art. 81º §Único — vira vermelho automático em dois casos: 2º amarelo na
 *  mesma partida, OU 1 amarelo + 1 azul juntos. Dois azuis sozinhos não
 *  convertem — o azul só converte quando combinado com um amarelo. */
function normalizarCartoes(ev, cfg) {
  if (!cfg.converterSegundoAmarelo) return ev;
  if ((ev.ca || 0) >= 2) return { ...ev, ca: ev.ca - 1, cv: (ev.cv || 0) + 1 };
  if ((ev.ca || 0) >= 1 && (ev.cz || 0) >= 1) return { ...ev, ca: ev.ca - 1, cz: ev.cz - 1, cv: (ev.cv || 0) + 1 };
  return ev;
}

function placarDe(jogo, rodada) {
  const tA = timePorId(rodada, jogo.timeA), tB = timePorId(rodada, jogo.timeB);
  const soma = (t) => idsDoTime(t).reduce((s, jid) => s + eventoDe(jogo, jid).gols, 0);
  // Gol não computado: entra no placar da própria equipe sem ser creditado a
  // nenhum jogador — usado quando quem marcou é alguém que não pontua (§10º).
  const calcA = soma(tA) + (jogo.golsContraB || 0) + (jogo.golsNaoComputadosA || 0);
  const calcB = soma(tB) + (jogo.golsContraA || 0) + (jogo.golsNaoComputadosB || 0);
  const m = jogo.placarManual;
  return { A: m ? m.A : calcA, B: m ? m.B : calcB, calcA, calcB, manual: !!m, divergente: !!m && (m.A !== calcA || m.B !== calcB) };
}

/**
 * Reaproveitamento de jogadores na mesma rodada (Art. 34º §10º).
 * Quem já apareceu numa partida anterior e entra depois só para completar
 * equipe não pontua nada — nem presença, nem resultado, nem gol, nem
 * assistência. O único registro que continua valendo contra ele é o cartão.
 * Todo mundo pontua normalmente na PRIMEIRA partida em que aparece.
 */
function marcarReaproveitamentos(rodada) {
  const jaApareceu = new Set();
  return [...(rodada.jogos || [])].sort((a, b) => a.numero - b.numero).map((jogo) => {
    // Começa com o que já veio marcado manualmente (§10, decidido na tela de
    // sorteio) — essa função só ACRESCENTA quem se repete, nunca apaga uma
    // marcação manual que o organizador já tinha feito.
    const soCartoes = [...(jogo.soCartoes || [])];
    for (const tid of [jogo.timeA, jogo.timeB]) {
      const time = timePorId(rodada, tid);
      for (const j of time?.jogadores || []) {
        if (jaApareceu.has(j.jogadorId)) { if (!soCartoes.includes(j.jogadorId)) soCartoes.push(j.jogadorId); }
        else jaApareceu.add(j.jogadorId);
      }
    }
    return { ...jogo, completaTime: [], soCartoes };
  });
}

function calcularEstatisticas(base) {
  const cfg = { ...CONFIG_PADRAO, ...(base.config || {}) };
  const hist = base.historicoInicial || { rodadas: 0, jogadores: {} };
  const disc = disciplinaAtrasos(base);
  const novo = {};
  for (const j of base.jogadores)
    novo[j.id] = { J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, CA: 0, CV: 0, CZ: 0, gols: 0, assistencias: 0, bonus: 0, penalidadeManual: 0, pontosAtraso: 0, atrasos: 0, sequencia: [] };

  const rodadas = [...base.rodadas].sort((a, b) => (a.data || "").localeCompare(b.data || "") || a.numero - b.numero);
  const encerrados = (r) => (r.jogos || []).filter((g) => g.encerrado);
  const rodadasNovas = rodadas.filter((r) => encerrados(r).length > 0).length;
  const rodadasRealizadas = (hist.rodadas || 0) + rodadasNovas;

  for (const rodada of rodadas) {
    const naRodada = {};
    for (const [jid, nivel] of Object.entries(disc.porRodada[rodada.id] || {})) {
      const st = novo[jid]; if (!st) continue;
      st.atrasos += 1;
      if (nivel === 2 && cfg.amareloNoSegundoAtraso) st.CA += 1;
      if (nivel === 3) st.pontosAtraso += cfg.pontoPerdidoTerceiroAtraso;
      if (nivel >= cfg.atrasosParaSuspensao && cfg.perdePontoNoQuartoAtraso) st.pontosAtraso += cfg.pontosPresenca;
    }

    for (const jogo of encerrados(rodada)) {
      // Art. 34º §10º — quem completa equipe não pontua NADA: nem presença,
      // nem gol, nem assistência, nem cartão. completaTime é o nome antigo do
      // mesmo conceito, mantido para bases já gravadas.
      const soCartoes = new Set([...(jogo.completaTime || []), ...(jogo.soCartoes || [])]);
      const p = placarDe(jogo, rodada);
      for (const lado of [
        { ids: idsDoTime(timePorId(rodada, jogo.timeA)), pro: p.A, contra: p.B },
        { ids: idsDoTime(timePorId(rodada, jogo.timeB)), pro: p.B, contra: p.A },
      ]) {
        const res = lado.pro > lado.contra ? "V" : lado.pro === lado.contra ? "E" : "D";
        for (const jid of lado.ids) {
          const st = novo[jid]; if (!st) continue;
          const ev = normalizarCartoes(eventoDe(jogo, jid), cfg);
          // Quem entrou só para completar o time não registra NADA: nem
          // pontos, nem gols, nem assistências, nem cartões. Apenas preenche a
          // vaga para o jogo acontecer.
          if (soCartoes.has(jid)) continue;
          st.J += 1; st[res] += 1; st.GP += lado.pro; st.GC += lado.contra;
          st.gols += ev.gols; st.assistencias += ev.assistencias; st.CA += ev.ca; st.CV += ev.cv; st.CZ += ev.cz;
          if (!naRodada[jid]) naRodada[jid] = res;
        }
      }
    }

    for (const aj of rodada.ajustes || []) {
      const st = novo[aj.jogadorId]; if (!st) continue;
      if (aj.valor >= 0) st.bonus += aj.valor; else st.penalidadeManual += Math.abs(aj.valor);
    }
    if (encerrados(rodada).length > 0)
      for (const j of base.jogadores) novo[j.id].sequencia.push(naRodada[j.id] || "–");
  }

  const denom = cfg.baseAproveitamento === "previstas" ? cfg.rodadasPrevistas : rodadasRealizadas;
  const teto = denom * cfg.tetoPorRodada;

  const lista = base.jogadores.map((j) => {
    const st = novo[j.id];
    const h = { ...HIST_ZERO, ...(hist.jogadores?.[j.id] || {}) };
    const CA = h.CA + st.CA, CV = h.CV + st.CV, CZ = h.CZ + st.CZ;
    // Art. 82º §2º — amarelo e azul dividem o mesmo ciclo de punição (cada
    // cartoesPorPonto cautelas, de qualquer uma das duas cores, tira 1 ponto).
    // O azul não aparece na tabela, mas pesa exatamente como um amarelo aqui.
    const cautelas = CA + CZ, cautelasHist = h.CA + h.CZ;
    const penalAmarelo = (Math.floor(cautelas / cfg.cartoesPorPonto) - Math.floor(cautelasHist / cfg.cartoesPorPonto)) * cfg.pontosPorCicloAmarelo;
    const penalVermelho = st.CV * cfg.pontosPorVermelho;
    const PmenosNovo = st.penalidadeManual + st.pontosAtraso + penalAmarelo + penalVermelho;
    const pontosNovos = st.J * cfg.pontosPresenca + st.V * cfg.pontosVitoria + st.E * cfg.pontosEmpate +
      st.D * cfg.pontosDerrota + st.bonus - PmenosNovo;
    const GP = h.GP + st.GP, GC = h.GC + st.GC;
    const estadoAtraso = disc.estado[j.id] || { contador: 0 };
    return {
      id: j.id, nome: j.nome, jogador: j,
      J: h.J + st.J, V: h.V + st.V, E: h.E + st.E, D: h.D + st.D,
      GP, GC, SG: GP - GC, CA, CV, CZ, cartoes: CA + CV,
      gols: h.gols + st.gols, assistencias: h.assistencias + st.assistencias,
      Pmais: h.Pmais + st.bonus, Pmenos: h.Pmenos + PmenosNovo, histPmenos: h.Pmenos,
      penalidadeManual: st.penalidadeManual, pontosAtraso: st.pontosAtraso, penalAmarelo, penalVermelho,
      cartoesNoCiclo: cautelas % cfg.cartoesPorPonto,
      pontos: h.P + pontosNovos, atrasos: st.atrasos, atrasosNoMes: estadoAtraso.contador,
      nivelAtraso: nivelInfo(estadoAtraso.contador, cfg),
      aproveitamento: teto > 0 ? Math.round(((h.P + pontosNovos) / teto) * 100) : 0,
      ultimos5: st.sequencia.slice(-5),
      temHistorico: !!hist.jogadores?.[j.id],
    };
  });

  return { lista, rodadasRealizadas, rodadasNovas, teto, disciplina: disc };
}

const COMPARADORES = {
  pontos: (a, b) => b.pontos - a.pontos, vitorias: (a, b) => b.V - a.V,
  saldo: (a, b) => b.SG - a.SG, golsPro: (a, b) => b.GP - a.GP,
  cartoes: (a, b) => a.cartoes - b.cartoes,
  alfabetica: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
};

function calcularClassificacao(base) {
  const cfg = { ...CONFIG_PADRAO, ...(base.config || {}) };
  const { lista, rodadasRealizadas, rodadasNovas, teto, disciplina } = calcularEstatisticas(base);
  const criterios = cfg.criteriosDesempate;
  const oficiais = lista.filter((l) => !l.jogador.convidado);
  const convidados = lista.filter((l) => l.jogador.convidado);
  const ordenada = [...oficiais].sort((a, b) => {
    for (const c of criterios) { const d = COMPARADORES[c](a, b); if (d !== 0) return d; }
    return 0;
  });

  /* Art. 34º §2º — a classe sai da posição GERAL na tabela, numa escala única
   * para todo mundo (goleiro entra na mesma fila que a linha): 1º-3º = 5★,
   * 4º-6º = 4★, 7º-9º = 3★, 10º-14º = 2★, 15º+ = 1★. Isso evita que um goleiro
   * vire "5★ isolado" só por ser o melhor entre poucos goleiros — o que
   * desequilibrava o sorteio mesmo com a soma de estrelas batendo. rankLinha/
   * rankGoleiro continuam existindo só para exibir "X° entre os goleiros" e
   * para o corte da Supercopa, que aí sim é por categoria. */
  const soLinha = ordenada.filter((l) => l.jogador.posicao !== "GOLEIRO");
  const soGoleiros = ordenada.filter((l) => l.jogador.posicao === "GOLEIRO");
  const rankLinha = new Map(soLinha.map((l, i) => [l.id, i + 1]));
  const rankGoleiro = new Map(soGoleiros.map((l, i) => [l.id, i + 1]));

  /* Supercopa: classificam os N melhores de LINHA e os 2 melhores GOLEIROS da
   * tabela geral. Entre as vagas de linha, 2 são reservadas aos campeões da
   * Copa Hendor de Penalidades: se já estiverem no corte por mérito, nada muda;
   * se não, entram e empurram o pior colocado da própria categoria para fora.
   * Goleiros têm corte próprio (não competem com a linha) — um goleiro campeão
   * da Hendor disputa vaga com os outros GOLEIROS, nunca com a linha. */
  const nLinhaSuper = cfg.zonaSupercopa ?? 12;
  const nGkSuper = cfg.goleirosSupercopa ?? 2;
  const hendor = new Set((cfg.campeoesHendor || []).filter(Boolean));

  const linhaClassificada = new Set(soLinha.slice(0, nLinhaSuper).map((l) => l.id));
  const hendorLinha = soLinha.filter((l) => hendor.has(l.id));
  for (const campeao of hendorLinha) {
    if (!linhaClassificada.has(campeao.id)) {
      linhaClassificada.add(campeao.id);
      const removivel = [...linhaClassificada].map((id) => soLinha.find((l) => l.id === id))
        .filter((l) => l && !hendor.has(l.id))
        .sort((a, b) => rankLinha.get(b.id) - rankLinha.get(a.id))[0];
      if (removivel) linhaClassificada.delete(removivel.id);
    }
  }
  const gkClassificado = new Set(soGoleiros.slice(0, nGkSuper).map((l) => l.id));
  const hendorGk = soGoleiros.filter((l) => hendor.has(l.id));
  for (const campeao of hendorGk) {
    if (!gkClassificado.has(campeao.id)) {
      gkClassificado.add(campeao.id);
      const removivel = [...gkClassificado].map((id) => soGoleiros.find((l) => l.id === id))
        .filter((l) => l && !hendor.has(l.id))
        .sort((a, b) => rankGoleiro.get(b.id) - rankGoleiro.get(a.id))[0];
      if (removivel) gkClassificado.delete(removivel.id);
    }
  }

  const classificacao = ordenada.map((l, i) => {
    const posicao = i + 1;
    let criterioAplicado = null;
    if (i > 0) for (const c of criterios)
      if (COMPARADORES[c](ordenada[i - 1], l) !== 0) { criterioAplicado = c; break; }
    const ehGk = l.jogador.posicao === "GOLEIRO";
    const rankCategoria = (ehGk ? rankGoleiro : rankLinha).get(l.id);
    return {
      ...l, posicao, criterioAplicado, ehGoleiro: ehGk, rankCategoria,
      totalCategoria: ehGk ? soGoleiros.length : soLinha.length,
      estrelas: rodadasRealizadas > 0 ? estrelasPorPosicao(posicao) : 1, // §11º: todos começam com 1★ · §2º: escala única (posição geral)
      supercopa: ehGk ? gkClassificado.has(l.id) : linhaClassificada.has(l.id),
      campeaoHendor: hendor.has(l.id),
    };
  });

  const convFinal = convidados.map((l) => ({
    ...l, posicao: null, criterioAplicado: null, ehGoleiro: l.jogador.posicao === "GOLEIRO",
    rankCategoria: null, totalCategoria: 0,
    estrelas: l.jogador.estrelasIniciais || 1, supercopa: false,
  }));

  return { classificacao, convidados: convFinal, todos: [...classificacao, ...convFinal], rodadasRealizadas, rodadasNovas, teto, disciplina };
}

/* --- core/sorteio --------------------------------------------------------
 * Distribui goleiro e linha juntos, como jogadores equivalentes — cada
 * equipe fecha com exatamente 1 goleiro + 4 de linha, e a estrela de todos
 * (goleiro incluso) entra igual na função objetivo. */
function chaveDupla(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
function variancia(v) {
  if (!v.length) return 0;
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  return v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length;
}

function avaliarTimes(times, ctx) {
  const P = ctx.pesos;
  const somas = times.map((t) => t.reduce((s, j) => s + j.estrelas, 0));
  const amplitude = Math.max(...somas) - Math.min(...somas);
  const mediaSomas = somas.reduce((s, v) => s + v, 0) / somas.length;
  const desvio = Math.sqrt(variancia(somas));

  let faixa = 0;
  for (let e = 1; e <= 5; e++) {
    const c = times.map((t) => t.filter((j) => j.estrelas === e).length);
    faixa += Math.max(...c) - Math.min(...c);
  }
  const vars = times.map((t) => variancia(t.map((j) => j.estrelas)));
  const ampVar = Math.max(...vars) - Math.min(...vars);

  let repeticao = 0;
  if (ctx.duplasRecentes)
    for (const t of times)
      for (let i = 0; i < t.length; i++)
        for (let k = i + 1; k < t.length; k++) {
          const d1 = ctx.duplasRecentes.get(chaveDupla(t[i].id, t[k].id)) || 0;
          repeticao += d1;
          for (let m = k + 1; m < t.length; m++) {
            const d2 = ctx.duplasRecentes.get(chaveDupla(t[i].id, t[m].id)) || 0;
            const d3 = ctx.duplasRecentes.get(chaveDupla(t[k].id, t[m].id)) || 0;
            if (d1 && d2 && d3) repeticao += 2;
          }
        }

  let ampAprov = 0;
  if (ctx.usarAproveitamento) {
    const md = times.map((t) => t.reduce((s, j) => s + (j.aproveitamento || 0), 0) / (t.length || 1));
    ampAprov = Math.max(...md) - Math.min(...md);
  }

  const violacoes = [];
  let rigidas = 0;      // violações contadas uma a uma
  let excessoGk = 0;    // excesso de goleiros, ao quadrado (ver abaixo)
  const max5 = Math.max(1, Math.ceil(ctx.totalCinco / times.length));
  times.forEach((t, i) => {
    const c5 = t.filter((j) => j.estrelas === 5).length;
    if (c5 > max5) { rigidas += 1; violacoes.push({ texto: `${ctx.nomeTime(i)} com ${c5} jogadores 5★` }); }

    /* Nunca dois goleiros de ofício na mesma equipe, esteja o segundo na meta ou
     * na linha. A penalidade é QUADRÁTICA no excesso porque a soma dos excessos
     * é constante quando todos precisam jogar: 3+2 e 4+1 somam o mesmo, e só o
     * quadrado (4+1=5 contra 9+0=9) faz o otimizador espalhar em vez de amontoar. */
    const gks = t.filter((j) => j.ehGoleiro);
    const excesso = Math.max(0, gks.length - ctx.goleirosPorTime);
    if (excesso > 0) {
      excessoGk += excesso * excesso;
      violacoes.push({ texto: `${ctx.nomeTime(i)} com ${gks.length} goleiros — ${gks.map((j) => j.nome).join(", ")}` });
    }

    if (ctx.goleirosSuficientes) {
      const naMeta = t.filter((j) => j.slotGoleiro).length;
      if (naMeta !== ctx.goleirosPorTime) {
        rigidas += 1;
        violacoes.push({ texto: `${ctx.nomeTime(i)} com ${naMeta} goleiro(s) na meta` });
      }
    }
  });
  for (const r of ctx.restricoes || []) {
    const ta = times.findIndex((t) => t.some((j) => j.id === r.a));
    const tb = times.findIndex((t) => t.some((j) => j.id === r.b));
    if (ta < 0 || tb < 0) continue;
    if (r.tipo === "juntos" && ta !== tb) { rigidas += 1; violacoes.push({ texto: `${ctx.nome(r.a)} e ${ctx.nome(r.b)} deveriam jogar juntos` }); }
    if (r.tipo === "separados" && ta === tb) { rigidas += 1; violacoes.push({ texto: `${ctx.nome(r.a)} e ${ctx.nome(r.b)} não deveriam jogar juntos` }); }
  }

  const custo = P.rigida * (rigidas + excessoGk) + P.amplitude * amplitude + P.desvio * desvio +
    P.faixa * faixa + P.varianciaInterna * ampVar + P.repeticao * repeticao +
    (ctx.usarAproveitamento ? P.aproveitamento * ampAprov : 0);

  return {
    custo, somas, amplitude, desvio, faixa, ampVar, repeticao, violacoes, mediaSomas,
    indiceEquilibrio: Math.max(0, Math.min(100, Math.round(100 - (mediaSomas > 0 ? (amplitude / mediaSomas) * 70 : 0)))),
  };
}

function buscaLocal(times, ctx) {
  let melhor = avaliarTimes(times, ctx);
  for (let passe = 0; passe < 40; passe++) {
    let melhorou = false;
    for (let a = 0; a < times.length; a++)
      for (let b = a + 1; b < times.length; b++)
        for (let i = 0; i < times[a].length; i++)
          for (let k = 0; k < times[b].length; k++) {
            const ja = times[a][i], jb = times[b][k];
            if (!!ja.slotGoleiro !== !!jb.slotGoleiro) continue; // vaga de goleiro só troca com vaga de goleiro
            // Goleiro só troca de LADO dentro da mesma partida, nunca de partida —
            // senão a busca local, ao perseguir equilíbrio de estrelas, desfaria o
            // espalhamento proposital dos goleiros entre as partidas (§12º).
            if (ja.slotGoleiro && ctx.partidaDoTime && ctx.partidaDoTime(a) !== ctx.partidaDoTime(b)) continue;
            if (ctx.travados.has(ja.id) || ctx.travados.has(jb.id)) continue;
            times[a][i] = jb; times[b][k] = ja;
            const nova = avaliarTimes(times, ctx);
            if (nova.custo < melhor.custo - 1e-9) { melhor = nova; melhorou = true; }
            else { times[a][i] = ja; times[b][k] = jb; }
          }
    if (!melhorou) break;
  }
  return melhor;
}

/**
 * Goleiro e linha entram juntos no mesmo sorteio, cada um disputando as vagas
 * da sua própria categoria: 1 de goleiro + 4 de linha por equipe.
 * O sorteio nunca promove jogador de linha a goleiro. Faltando goleiro, a vaga
 * de meta sai VAZIA e quem completa é escolhido na mão (Art. 34º §14º/§17º).
 * Quem excede as vagas — goleiro ou linha — vira sobressalente e vai para a
 * partida adicional do §10º.
 */
function sortearEquipes(entradas, opcoes = {}) {
  const cfg = { ...CONFIG_PADRAO, ...opcoes, pesos: { ...CONFIG_PADRAO.pesos, ...(opcoes.pesos || {}) } };
  const seed = opcoes.seed || novaSeed();
  const rng = criarRng(seed);
  const gkPorTime = cfg.goleirosPorTime;
  const linhaPorTime = cfg.jogadoresPorTime - gkPorTime;

  const goleiros = entradas.filter((j) => j.ehGoleiro);
  const linha = entradas.filter((j) => !j.ehGoleiro);
  // Regra do campeonato: TODA partida é 8 de linha + 2 goleiros. O número de
  // partidas é o necessário para acomodar a linha (8/partida) e os goleiros
  // (2/partida) — o que exigir mais manda. Vagas que faltarem ficam abertas nas
  // últimas partidas e são completadas na mão (quem repete não pontua de novo).
  const nLinhaPresente = entradas.filter((j) => !j.ehGoleiro).length;
  const nGkPresente = entradas.filter((j) => j.ehGoleiro).length;
  const maxPartidas = partidasPossiveis(nLinhaPresente, nGkPresente, cfg);
  const partidas = Math.max(0, Math.min(opcoes.partidas || maxPartidas, maxPartidas));
  const nTimes = partidas * 2;

  if (partidas < 1) return {
    erro: `Nenhum jogador presente para sortear.`,
    partidas: [], sobressalentes: entradas, seed, diagnostico: null,
  };

  const vagasGk = nTimes * gkPorTime;
  const vagasLinha = nTimes * linhaPorTime;
  const travas = opcoes.travas || {};
  const travados = new Set(Object.keys(travas).filter((k) => travas[k] < nTimes));

  const selecionar = (grupo, quantos) => {
    const fixos = grupo.filter((j) => travados.has(j.id));
    const resto = embaralharRng(grupo.filter((j) => !travados.has(j.id)), rng)
      .sort((a, b) => (a.prioridade || 0) - (b.prioridade || 0));
    const esc = [...fixos, ...resto].slice(0, quantos);
    const ids = new Set(esc.map((j) => j.id));
    return [esc, grupo.filter((j) => !ids.has(j.id))];
  };

  /* Cada categoria preenche primeiro as próprias vagas. Sobras (de goleiro ou
   * linha) são reaproveitadas na etapa de compactação, que decide quem entra e
   * concentra as vagas verdadeiramente livres na última partida. */
  const [gkFinal0, gkSobrando] = selecionar(goleiros, vagasGk);
  const [linhaFinal, linhaSobrando] = selecionar(linha, vagasLinha);
  const gkFinal = gkFinal0.map((j) => ({ ...j, slotGoleiro: true }));
  const faltamGk = vagasGk - gkFinal.length;
  const faltamLinha = vagasLinha - linhaFinal.length;

  const nomes = Object.fromEntries(entradas.map((j) => [j.id, j.nome]));

  // Cada equipe passa a ser um conjunto de VAGAS fixas: 1 de goleiro + 4 de
  // linha. Vaga vazia (jogador: null) é o que a interface oferece para
  // preenchimento manual entre os presentes.
  const vagasDe = (jogadores) => {
    const gk = jogadores.filter((j) => j.slotGoleiro);
    const ln = jogadores.filter((j) => !j.slotGoleiro);
    const vagas = [];
    for (let i = 0; i < gkPorTime; i++) vagas.push({ papel: "GOLEIRO", jogador: gk[i] || null });
    for (let i = 0; i < linhaPorTime; i++) vagas.push({ papel: "LINHA", jogador: ln[i] || null });
    return vagas;
  };
  const equipe = (cor, jogadores) => {
    const vagas = vagasDe(jogadores);
    return { ...cor, vagas, forca: jogadores.reduce((s, j) => s + j.estrelas, 0) };
  };

  /* Regra do campeonato: só a ÚLTIMA partida pode ter vagas de LINHA em
   * aberto; as anteriores saem completas. Por isso a linha é espalhada em
   * SERPENTINA entre as partidas, com um "alvo" de vagas por partida: as
   * primeiras enchem por completo, a última recebe o resto.
   * Goleiro é uma exceção deliberada a essa regra (§12º): em vez de
   * concentrar os goleiros de ofício sempre na Partida 1 e deixar as demais
   * sem nenhum goleiro de verdade — o que esvazia o gol justo nos últimos
   * jogos do dia, quando quem já jogou fica sem interesse em completar —,
   * os goleiros presentes são ESPALHADOS entre as partidas antes de dobrar
   * em qualquer uma delas. */
  // Todos os presentes, sem descartar ninguém. Quem a seleção deixou de fora
  // por excesso volta ao pote (será usado para completar vagas de gol).
  const poteGk = [...gkFinal, ...gkSobrando.map((j) => ({ ...j, slotGoleiro: true }))]
    .sort((a, b) => b.estrelas - a.estrelas);
  const poteLinha = [...linhaFinal, ...linhaSobrando].sort((a, b) => b.estrelas - a.estrelas);

  const capLn = linhaPorTime * 2;
  // cada posição guarda até gkPorTime×2 goleiros — pode ficar com buracos
  const gksPorPartida = Array.from({ length: partidas }, () => Array(gkPorTime * 2).fill(null));
  const lnsPorPartida = Array.from({ length: partidas }, () => []);

  const filaG = [...poteGk];
  const filaL = [...poteLinha];

  // 1) goleiros: preenchidos em VOLTAS — cada volta passa uma vez por todas as
  //    partidas no lado amarelo (ida) e depois por todas de novo no lado azul
  //    (volta). Assim, faltando goleiro, quem sobra fica sem meta espalhado
  //    pelas partidas, em vez de esvaziar sempre as últimas.
  for (let volta = 0; volta < gkPorTime && filaG.length; volta++) {
    for (let p = 0; p < partidas && filaG.length; p++) gksPorPartida[p][volta * 2] = { ...filaG.shift(), slotGoleiro: true };
    for (let p = partidas - 1; p >= 0 && filaG.length; p--) gksPorPartida[p][volta * 2 + 1] = { ...filaG.shift(), slotGoleiro: true };
  }

  // 2) linha: define quantas vagas de linha cada partida terá de fato. As vagas
  //    que ficarão vazias são tiradas da última partida para trás.
  const alvoLn = Array(partidas).fill(capLn);
  let faltamLn = partidas * capLn - filaL.length;
  for (let p = partidas - 1; p >= 0 && faltamLn > 0; p--) {
    const tira = Math.min(faltamLn, capLn);
    alvoLn[p] -= tira; faltamLn -= tira;
  }

  // 3) distribui a linha em serpentina, respeitando o alvo de cada partida
  {
    let dir = 1, idx = 0;
    for (const jr of filaL) {
      const j = { ...jr, slotGoleiro: false };
      let t = 0;
      while (lnsPorPartida[idx].length >= alvoLn[idx] && t < partidas * 2) {
        idx += dir;
        if (idx >= partidas) { idx = partidas - 1; dir = -1; }
        else if (idx < 0) { idx = 0; dir = 1; }
        t++;
      }
      if (lnsPorPartida[idx].length < alvoLn[idx]) lnsPorPartida[idx].push(j);
      idx += dir;
      if (idx >= partidas) { idx = partidas - 1; dir = -1; }
      else if (idx < 0) { idx = 0; dir = 1; }
    }
  }

  const repartir = (gks, lns) => {
    const A = [], B = [];
    if (gks[0]) A.push(gks[0]);
    if (gks[1]) B.push(gks[1]);
    [...lns].sort((a, b) => b.estrelas - a.estrelas)
      .forEach((j, i) => (i % 4 === 0 || i % 4 === 3 ? A : B).push(j));
    return [A, B];
  };

  const times = [];
  for (let p = 0; p < partidas; p++) {
    const [A, B] = repartir(gksPorPartida[p] || [], lnsPorPartida[p] || []);
    times.push(A, B);
  }

  /* A distribuição acima já respeita vagas/posições e é um bom ponto de
   * partida, mas sozinha não garante o melhor equilíbrio possível. Antes o
   * sorteio calculava uma divisão bem otimizada (avaliarTimes/buscaLocal) só
   * para EXIBIR um diagnóstico bonito e depois construía as partidas de
   * verdade com essa distribuição simples, ignorando a otimização — por isso
   * o equilíbrio real ficava pior do que o anunciado. Agora a busca local
   * roda sobre as equipes que de fato serão exibidas/gravadas, trocando
   * jogadores ENTRE elas até minimizar o mesmo custo do diagnóstico. */
  const assentados = times.flat();
  const ctx = {
    pesos: cfg.pesos, goleirosPorTime: gkPorTime,
    goleirosSuficientes: false, // goleiro pode faltar em mais de uma partida, de propósito (§12º)
    totalCinco: assentados.filter((j) => j.estrelas === 5).length,
    duplasRecentes: opcoes.duplasRecentes,
    restricoes: (opcoes.restricoes || []).filter((r) => assentados.some((j) => j.id === r.a) && assentados.some((j) => j.id === r.b)),
    usarAproveitamento: cfg.usarAproveitamento, travados,
    partidaDoTime: (i) => Math.floor(i / 2),
    nome: (x) => nomes[x] || "?", nomeTime: (i) => `Time ${i + 1}`,
  };
  const avaliacaoFinal = buscaLocal(times, ctx);

  const blocos = [];
  for (let p = 0; p < partidas; p++) {
    const A = times[p * 2], B = times[p * 2 + 1];
    blocos.push({
      numero: p + 1, extra: false,
      preenchimento: A.length + B.length,
      amarelo: equipe(AMARELO, A), azul: equipe(AZUL, B),
    });
  }
  blocos.sort((a, b) => b.preenchimento - a.preenchimento);
  blocos.forEach((b, i) => { b.numero = i + 1; delete b.preenchimento; });

  /* Sobressalentes de verdade: quem, no fim, não entrou em NENHUMA partida.
   * Com a distribuição atual isso só acontece se houver mais presentes que
   * vagas (raro, exigiria mais de 3 partidas). Todos os demais foram escalados,
   * inclusive os que a seleção inicial havia cortado. */
  const idsEscalados = new Set();
  for (const b of blocos)
    for (const e of [b.amarelo, b.azul])
      for (const v of e.vagas)
        if (v.jogador) idsEscalados.add(v.jogador.id);
  const naoAlocados = entradas.filter((j) => !idsEscalados.has(j.id));

  const avisos = [];
  if (ctx.totalCinco > nTimes) avisos.push(`${ctx.totalCinco} jogadores 5★ para ${nTimes} equipes — o excedente foi espalhado, mas uma equipe fica com 2.`);
  const gkDeFora = naoAlocados.filter((j) => j.ehGoleiro);
  if (gkDeFora.length) avisos.push(`${gkDeFora.map((g) => g.nome).join(", ")} — sem vaga nesta rodada (mais presentes que vagas).`);
  for (const v of avaliacaoFinal.violacoes) avisos.push(v.texto);

  return {
    erro: null, seed,
    partidas: blocos,
    sobressalentes: naoAlocados,
    diagnostico: { ...avaliacaoFinal, alternativas: 1, avisos },
  };
}

/* --- core/exportacao -----------------------------------------------------*/
function paraCSV(l) {
  return l.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(";")).join("\n");
}
function csvClassificacao(cl) {
  const cab = ["Pos", "Jogador", "Posição", "Estrelas", "P", "%", "J", "V", "E", "D", "GP", "GC", "SG", "Gols", "Ass", "CA", "CV", "P+", "P-", "Atrasos no mês", "Últimos 5"];
  return paraCSV([cab, ...cl.map((l) => [l.posicao, l.nome, l.jogador.posicao, l.estrelas, l.pontos,
  `${l.aproveitamento}%`, l.J, l.V, l.E, l.D, l.GP, l.GC, l.SG, l.gols, l.assistencias, l.CA, l.CV, l.Pmais, l.Pmenos, l.atrasosNoMes, l.ultimos5.join(" ")])]);
}
function csvSumula(rodada, nomes, niveis) {
  const linhas = [["Rodada", rodada.numero, "Data", rodada.data]];
  const atrasados = Object.entries(niveis || {});
  if (atrasados.length) {
    linhas.push([]); linhas.push(["ATRASOS (Art. 34º §8º)", "Jogador", "Nível", "Punição"]);
    for (const [jid, n] of atrasados) linhas.push(["", nomes[jid] || jid, `${n}º`, nivelInfo(n)?.rotulo || ""]);
  }
  if ((rodada.ajustes || []).length) {
    linhas.push([]); linhas.push(["AJUSTES P+ / P−", "Jogador", "Valor", "Motivo"]);
    for (const aj of rodada.ajustes) linhas.push(["", nomes[aj.jogadorId] || aj.jogadorId, aj.valor, aj.motivo || ""]);
  }
  for (const jogo of rodada.jogos || []) {
    const tA = timePorId(rodada, jogo.timeA), tB = timePorId(rodada, jogo.timeB);
    if (!tA || !tB) continue;
    const p = placarDe(jogo, rodada);
    linhas.push([]);
    linhas.push([`PARTIDA ${jogo.numero}`, "AMARELO", p.A, "×", p.B, "AZUL", jogo.encerrado ? "encerrada" : "em aberto"]);
    if (p.divergente) linhas.push(["Divergência", `soma dos gols ${p.calcA}×${p.calcB}`, `placar lançado ${p.A}×${p.B}`]);
    linhas.push(["Gol contra", "AMARELO", jogo.golsContraA || 0, "AZUL", jogo.golsContraB || 0]);
    linhas.push(["Gol não computado", "AMARELO", jogo.golsNaoComputadosA || 0, "AZUL", jogo.golsNaoComputadosB || 0]);
    linhas.push(["Equipe", "Jogador", "Função", "Gols", "Assist.", "CA", "CV", "CAzul", "Atraso", "Observação"]);
    for (const t of [tA, tB]) for (const j of t.jogadores || []) {
      const ev = eventoDe(jogo, j.jogadorId);
      const obs = [...(jogo.completaTime || []), ...(jogo.soCartoes || [])].includes(j.jogadorId)
        ? "Completou equipe (§10º) — não pontua nada, nem cartão" : "";
      linhas.push([t.cor, nomes[j.jogadorId] || j.jogadorId, j.atuaComoGoleiro ? "Goleiro" : "Linha",
      ev.gols, ev.assistencias, ev.ca, ev.cv, ev.cz, niveis?.[j.jogadorId] ? `${niveis[j.jogadorId]}º` : "", obs]);
    }
  }
  return paraCSV(linhas);
}
function textoWhatsApp(partidas, rodada, diag, seed) {
  const data = new Date(rodada.data + "T12:00:00").toLocaleDateString("pt-BR");
  let t = `*CAMPEONATO JPFFS*\nRodada ${rodada.numero} — ${data}\n`;
  for (const p of partidas) {
    t += `\n*── PARTIDA ${p.numero}${p.extra ? " (sobressalentes)" : ""} ──*\n`;
    for (const lado of [p.amarelo, p.azul]) {
      t += `\n${lado.emoji} *${lado.cor}* — ${lado.forca}★\n`;
      for (const v of lado.vagas) {
        if (!v.jogador) { t += `${v.papel === "GOLEIRO" ? "🧤" : "•"} _(vaga em aberto)_\n`; continue; }
        const noGol = v.papel === "GOLEIRO";
        t += `${noGol ? "🧤" : "•"} ${v.jogador.nome} ${"★".repeat(v.jogador.estrelas)}\n`;
      }
    }
  }
  t += `\n⚖️ Equilíbrio ${diag.indiceEquilibrio}% · diferença de ${diag.amplitude}★\n🎲 Sorteio ${seed}`;
  return t;
}

function imagemTabela(cl, cfg, meta) {
  const cols = [
    { k: "posicao", r: "#", w: 46, al: "center" }, { k: "nome", r: "JOGADOR", w: 208, al: "left" },
    { k: "estrelas", r: "CLASSE", w: 82, al: "center" }, { k: "pontos", r: "P", w: 52, al: "right" },
    { k: "aproveitamento", r: "%", w: 56, al: "right" }, { k: "J", r: "J", w: 38, al: "right" },
    { k: "V", r: "V", w: 38, al: "right" }, { k: "E", r: "E", w: 38, al: "right" }, { k: "D", r: "D", w: 38, al: "right" },
    { k: "GP", r: "GP", w: 44, al: "right" }, { k: "GC", r: "GC", w: 44, al: "right" }, { k: "SG", r: "SG", w: 48, al: "right" },
    { k: "gols", r: "GOLS", w: 50, al: "right" }, { k: "assistencias", r: "ASS", w: 46, al: "right" },
    { k: "ultimos5", r: "ÚLT. 5", w: 106, al: "center" },
  ];
  const esc = 2, pad = 26, hCab = 116, hLinha = 34, hHead = 34;
  const larg = cols.reduce((s, c) => s + c.w, 0) + pad * 2;
  const alt = hCab + hHead + cl.length * hLinha + 56;

  const logo = new Image();
  logo.onload = () => desenhar(logo);
  logo.onerror = () => desenhar(null);
  logo.src = ESCUDO;

  function desenhar(escudo) {
    const cv = document.createElement("canvas");
    cv.width = larg * esc; cv.height = alt * esc;
    const x = cv.getContext("2d");
    x.scale(esc, esc); x.textBaseline = "middle";
    const g = x.createLinearGradient(0, 0, 0, alt);
    g.addColorStop(0, T.fundoTopo); g.addColorStop(0.45, "#0a2557"); g.addColorStop(1, T.fundoBase);
    x.fillStyle = g; x.fillRect(0, 0, larg, alt);

    const hEscudo = 70;
    if (escudo) {
      const wEscudo = escudo.width * (hEscudo / escudo.height);
      x.drawImage(escudo, pad, 18, wEscudo, hEscudo);
    }
    const xTexto = pad + (escudo ? escudo.width * (hEscudo / escudo.height) + 18 : 0);
    x.textAlign = "left";
    x.fillStyle = T.ouro; x.font = "900 26px system-ui, sans-serif";
    x.fillText("CAMPEONATO JPFFS", xTexto, 40);
    x.fillStyle = T.texto; x.font = "700 15px system-ui, sans-serif";
    x.fillText("CLASSIFICAÇÃO GERAL", xTexto, 64);
    x.fillStyle = T.secundario; x.font = "400 12px system-ui, sans-serif";
    x.fillText(`${meta.rodadas} rodadas · teto ${meta.teto} pts · P = J + 3V + E + P⁺ − P⁻`, xTexto, 86);
    x.textAlign = "right"; x.fillText(new Date().toLocaleDateString("pt-BR"), larg - pad, 86);

    let y = hCab;
    x.fillStyle = "rgba(255,255,255,0.06)"; x.fillRect(0, y, larg, hHead);
    x.fillStyle = T.ouro; x.fillRect(0, y + hHead - 2, larg, 2);
    x.font = "800 11px system-ui, sans-serif"; x.fillStyle = T.secundario;
    let cx = pad;
    for (const c of cols) {
      x.textAlign = c.al === "center" ? "center" : c.al;
      x.fillText(c.r, c.al === "left" ? cx : c.al === "center" ? cx + c.w / 2 : cx + c.w - 6, y + hHead / 2);
      cx += c.w;
    }
    y += hHead;
    cl.forEach((l, i) => {
      if (i % 2 === 1) { x.fillStyle = "rgba(255,255,255,0.04)"; x.fillRect(0, y, larg, hLinha); }
      if (l.supercopa) { x.fillStyle = T.ouroFraco; x.fillRect(0, y, larg, hLinha); x.fillStyle = T.ouro; x.fillRect(0, y, 4, hLinha); }
      let cx2 = pad;
      for (const c of cols) {
        const cy = y + hLinha / 2;
        x.textAlign = c.al === "center" ? "center" : c.al;
        const px = c.al === "left" ? cx2 : c.al === "center" ? cx2 + c.w / 2 : cx2 + c.w - 6;
        if (c.k === "estrelas") {
          x.font = "13px system-ui, sans-serif"; x.fillStyle = T.ouro;
          x.fillText("★".repeat(l.estrelas), px, cy);
        } else if (c.k === "ultimos5") {
          const w = 16, gap = 3;
          let sx = cx2 + (c.w - (l.ultimos5.length * (w + gap) - gap)) / 2;
          for (const r of l.ultimos5) {
            x.fillStyle = r === "V" ? T.verde : r === "E" ? "#5A76A8" : r === "D" ? T.vermelho : "rgba(255,255,255,.08)";
            x.fillRect(sx, cy - 8, w, 16);
            x.fillStyle = r === "V" || r === "D" ? "#06122b" : T.texto;
            x.font = "800 10px system-ui, sans-serif"; x.textAlign = "center";
            x.fillText(r, sx + w / 2, cy); sx += w + gap;
          }
        } else {
          let v = l[c.k];
          if (c.k === "aproveitamento") v = `${v}%`;
          if (c.k === "SG") v = (l.SG > 0 ? "+" : "") + l.SG;
          x.font = c.k === "pontos" ? "800 15px system-ui, sans-serif" : c.k === "nome" ? "600 13px system-ui, sans-serif" : "400 12px system-ui, sans-serif";
          x.fillStyle = c.k === "pontos" ? T.ouro : c.k === "posicao" ? (l.supercopa ? T.ouro : T.fraco)
            : c.k === "nome" ? T.texto : c.k === "SG" ? (l.SG > 0 ? T.verde : l.SG < 0 ? T.vermelho : T.fraco) : T.secundario;
          if (c.k === "nome" && l.jogador.posicao === "GOLEIRO") {
            x.fillStyle = T.gk; x.font = "800 10px system-ui, sans-serif"; x.fillText("G", px, cy);
            x.fillStyle = T.texto; x.font = "600 13px system-ui, sans-serif"; x.fillText(String(v), px + 14, cy);
          } else x.fillText(String(v), px, cy);
        }
        cx2 += c.w;
      }
      y += hLinha;
    });
    x.textAlign = "left"; x.fillStyle = T.fraco; x.font = "400 11px system-ui, sans-serif";
    x.fillText(`Faixa dourada: zona de classificação da Supercopa (1º ao ${cfg.zonaSupercopa}º)  ·  G = goleiro`, pad, y + 26);
    cv.toBlob((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url; a.download = "jpffs-classificacao.png"; a.click();
      URL.revokeObjectURL(url);
    });
  }
}

function baixarArquivo(nome, conteudo, tipo = "text/csv;charset=utf-8") {
  const blob = new Blob(["\uFEFF" + conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}

/* ==================== SEED: classificação da 21ª rodada ================== */
const SEED_20 = `
PIETRO|.|65|21|13|6|2|34|14|1|1|0|1|28|2
JOÃO VITOR|G|54|21|10|3|8|19|16|0|0|0|0|2|0
PATRICK|.|51|19|10|2|7|21|14|0|0|0|0|5|3
ALESSON|.|49|16|9|6|1|31|15|3|0|1|1|11|3
ALEX|.|49|20|9|2|9|23|30|1|0|0|0|9|4
VICTOR|.|49|20|7|8|5|21|15|2|0|0|0|6|3
RICARDINHO|.|49|21|7|7|7|13|13|1|0|0|0|2|4
WELLK|.|48|14|11|1|2|27|11|1|0|0|0|9|6
KAIKE|.|48|19|8|6|5|20|14|3|0|0|1|6|1
HUDSON|.|46|18|8|4|6|16|13|1|0|0|0|2|4
GUENO|.|45|17|9|3|5|27|18|4|0|0|2|5|5
EMANUEL|.|45|19|7|5|7|23|24|1|0|0|0|5|3
LUIS PAULO|.|45|20|6|6|8|15|19|2|0|1|0|2|3
FABIANO|.|43|19|7|3|9|23|23|0|0|0|0|7|3
RENATO|.|43|19|7|4|8|20|23|2|1|0|1|6|1
TILMAR|.|43|20|5|8|7|19|26|1|0|0|0|5|1
JEAN|.|42|17|8|1|8|18|17|0|0|0|0|1|7
EDER|.|41|15|7|5|3|16|12|2|0|0|0|2|4
ARANHA|.|41|18|6|5|7|11|15|0|0|0|0|1|3
TERUYA|.|39|16|6|5|5|13|11|1|0|0|0|2|1
PAULO CÉSAR|.|39|18|6|3|9|15|20|0|0|0|0|1|1
SAMUEL|.|39|17|6|4|7|18|25|1|1|1|1|2|2
LÁZARO|.|38|12|8|0|4|16|11|1|0|2|0|4|5
FLAVINHO|.|38|12|6|4|2|12|10|1|0|4|0|1|2
MARKS|G|38|16|5|5|6|15|16|1|0|2|0|0|0
MATHEUS CUNHA|.|37|18|4|7|7|17|17|0|0|0|0|4|5
WELLINGTON|.|36|16|5|5|6|10|12|0|0|0|0|2|1
LEON|.|35|18|4|5|9|19|24|0|0|0|0|2|1
BRUNO GORDO|.|34|11|7|2|2|15|9|1|0|0|0|5|3
DANIEL|.|33|14|6|1|7|14|21|1|0|0|0|1|3
GILMAR PAQUETÁ|.|33|13|4|8|1|19|9|0|0|0|0|5|5
HENDOR|.|30|11|6|1|4|9|8|0|0|0|0|4|2
RODRIGO NANTES|G|30|12|5|3|4|16|14|0|0|0|0|0|0
CARLOS|.|30|15|3|4|8|7|18|0|0|2|0|0|1
GABRIEL|.|28|12|4|3|5|12|15|1|0|1|0|3|2
RAFAEL DELGADO|.|27|10|5|2|3|15|10|0|0|0|0|3|4
ANDRÉ|.|27|13|3|4|6|12|13|0|0|1|0|3|1
JAPA|.|26|9|5|2|2|12|8|0|0|0|0|3|1
LUCIANO|.|23|11|3|3|5|11|10|0|0|0|0|3|0
LOTHAR|.|21|15|1|3|11|7|28|1|0|0|0|2|0
FRED|.|18|10|2|2|6|4|14|1|0|0|0|0|0
EMERSON TIXA|.|17|11|1|3|7|3|12|2|0|0|0|0|0
MÁRCIO BOM D+|.|15|11|3|0|8|14|18|0|0|0|5|2|2
LEOMAR|.|13|5|1|4|0|5|3|0|0|1|0|0|1
ALEXANDRE|.|12|6|1|3|2|5|5|0|0|0|0|0|1
BATTISTON|G|10|4|2|0|2|5|3|0|0|0|0|0|0
ENTONY|.|10|4|2|0|2|3|3|0|0|0|0|2|0
JUDSON|.|10|6|1|1|4|5|11|0|0|0|0|0|1
CARLOTA|.|9|5|1|1|3|4|4|0|0|0|0|0|1
RODRIGO COSTA|.|9|5|1|1|3|4|7|1|0|0|0|0|0
DOUGLAS|.|7|4|1|0|3|5|7|0|0|0|0|0|0
GUSTAVO|.|5|2|1|0|1|5|3|0|0|0|0|1|0
ESPINOSA|.|5|2|1|0|1|3|5|0|0|0|0|0|1
JEFERSON|.|4|1|1|0|0|4|0|0|0|0|0|1|1
LUIS FERNANDO|.|4|1|1|0|0|2|0|0|0|0|0|0|1
WESLEY SAFADÃO|.|4|3|0|1|2|2|5|1|0|0|0|1|0
GLEDSON|.|2|1|0|1|0|1|1|0|0|0|0|1|0
JHONATANN|.|2|2|0|0|2|1|5|0|0|0|0|0|0
ADRIANO|.|1|0|0|0|0|0|0|0|0|1|0|0|0
AGOSTINHO|.|1|1|0|0|1|2|3|0|0|0|0|0|0
BRUNO PORTO|.|1|1|0|0|1|0|1|0|0|0|0|0|0
`.trim();

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");

function baseOficial() {
  const jogadores = [], hist = {};
  for (const l of SEED_20.split("\n")) {
    const [nome, g, P, J, V, E, D, GP, GC, CA, CV, Pmais, Pmenos, gols, ass] = l.split("|");
    const jid = slug(nome);
    jogadores.push({
      id: jid, nome, posicao: g === "G" ? "GOLEIRO" : "LINHA", ativo: true, convidado: false,
      estrelasIniciais: 1, pendenciaFinanceira: false, pontuacaoPendente: false, posicaoInferida: false
    });
    hist[jid] = { P: +P, J: +J, V: +V, E: +E, D: +D, GP: +GP, GC: +GC, CA: +CA, CV: +CV, Pmais: +Pmais, Pmenos: +Pmenos, gols: +gols, assistencias: +ass };
  }
  return {
    versao: 6, campeonato: "Campeonato JPFFS", temporada: 2026,
    config: { ...CONFIG_PADRAO }, jogadores, rodadas: [], restricoes: [],
    historicoInicial: { rodadas: 21, data: "2026-08-01", descricao: "Classificação oficial consolidada após a 21ª rodada", jogadores: hist },
  };
}

/* --- infra/repositorio (Supabase) ---------------------------------------*/
/* A base do campeonato mora em uma única linha da tabela `public.base`,
 * coluna `dados` (jsonb). Leitura é liberada para qualquer visitante; escrita
 * só é aceita para organizadores autenticados (garantido por RLS no banco). */

async function carregarBase() {
  try {
    const { data, error } = await supabase
      .from("base")
      .select("dados")
      .eq("id", 1)
      .single();
    if (error) throw error;
    const b = data?.dados;
    return b && Object.keys(b).length ? migrarBase(b) : null;
  } catch (e) {
    console.error("Falha ao carregar a base:", e);
    return null;
  }
}

async function salvarBase(b) {
  // Backup local imediato: mesmo sem internet ou se o Supabase falhar, os dados
  // ficam guardados no dispositivo e são reenviados depois. Nunca se perde o
  // que foi lançado.
  try { localStorage.setItem("jpffs:backup", JSON.stringify({ dados: b, em: Date.now() })); } catch { }

  const gravar = async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s?.session) return "sem-sessao"; // visitante: não grava no servidor
    const { error } = await supabase
      .from("base")
      .update({ dados: b, atualizado_em: new Date().toISOString(), atualizado_por: s.session.user.email || null })
      .eq("id", 1);
    if (error) throw error;
    return true;
  };

  try {
    return (await gravar()) === true;
  } catch (e) {
    // uma re-tentativa após breve espera, antes de desistir
    console.warn("Falha ao salvar, tentando de novo…", e);
    await new Promise((r) => setTimeout(r, 1200));
    try { return (await gravar()) === true; }
    catch (e2) { console.error("Falha ao salvar a base (persistido só localmente):", e2); return false; }
  }
}
const id = () => Math.random().toString(36).slice(2, 10);

function migrarBase(base) {
  const b = { ...baseOficial(), ...base, config: { ...CONFIG_PADRAO, ...(base.config || {}), pesos: { ...CONFIG_PADRAO.pesos, ...(base.config?.pesos || {}) } } };
  b.restricoes = b.restricoes || [];
  b.historicoInicial = base.historicoInicial || { rodadas: 0, jogadores: {} };
  b.jogadores = (b.jogadores || []).map((j) => ({ ...j, posicao: /goleiro/i.test(j.posicao || "") ? "GOLEIRO" : "LINHA", convidado: !!j.convidado }));
  b.rodadas = (b.rodadas || []).map((r) => ({
    ...r, ajustes: r.ajustes || [], times: r.times || [],
    jogos: (r.jogos || []).map((g) => ({ ...g, soCartoes: g.soCartoes || [], golsNaoComputadosA: g.golsNaoComputadosA || 0, golsNaoComputadosB: g.golsNaoComputadosB || 0 })),
  }));
  return b;
}

/* ============================== INTERFACE ================================ */

/** Estrelas em ouro para jogadores de linha e em azul para goleiros — é só
 *  identificação visual da posição; a escala (§2º) é única para todo mundo,
 *  baseada na posição geral da tabela. */
const Estrelas = ({ n, tam = 12, goleiro }) => (
  <span title={goleiro ? "Classe (goleiro) — escala geral" : "Classe (linha) — escala geral"}
    style={{ fontSize: tam, letterSpacing: -1, color: goleiro ? T.gk : T.ouro, whiteSpace: "nowrap" }}>
    {"★".repeat(Math.max(0, n))}<span style={{ color: "rgba(255,255,255,.16)" }}>{"★".repeat(Math.max(0, 5 - n))}</span>
  </span>
);

const IconeGoleiro = ({ tam = 15 }) => (
  <span title="Goleiro" style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: tam, height: tam,
    borderRadius: 4, background: T.gk, color: "#04142f", fontSize: tam * 0.66, fontWeight: 900, flexShrink: 0
  }}>G</span>
);

const SeloAtraso = ({ nivel, cfg, mini }) => {
  const i = nivelInfo(nivel, cfg); if (!i) return null;
  return <span title={i.rotulo} style={{
    background: `${i.cor}28`, color: i.cor, border: `1px solid ${i.cor}66`, borderRadius: 4,
    padding: mini ? "0 3px" : "1px 5px", fontSize: mini ? 9 : 10, fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0
  }}>
    {mini ? i.curto : i.rotulo}</span>;
};

function Botao({ children, onClick, variante = "primario", className = "", disabled, style }) {
  const v = {
    primario: { background: `linear-gradient(180deg,${T.ouroClaro},${T.ouro})`, color: "#0a1b3d", border: "none" },
    secundario: { background: "rgba(255,255,255,0.07)", color: T.texto, border: `1px solid ${T.borda}` },
    perigo: { background: "#B02121", color: "#fff", border: "none" },
  }[variante];
  return <button onClick={onClick} disabled={disabled} className={`rounded-lg px-4 ${className}`}
    style={{ ...v, minHeight: 48, fontSize: 13, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", opacity: disabled ? 0.4 : 1, ...style }}>{children}</button>;
}

const inputStyle = { width: "100%", background: "rgba(0,0,0,0.28)", border: `1px solid ${T.borda}`, borderRadius: 8, padding: "12px", color: T.texto, fontSize: 15, outline: "none" };

function Campo({ rotulo, children, dica }) {
  return <label className="block">
    <span style={{ display: "block", marginBottom: 4, fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: T.fraco }}>{rotulo}</span>
    {children}
    {dica && <span style={{ display: "block", marginTop: 4, fontSize: 10.5, lineHeight: 1.35, color: T.fraco }}>{dica}</span>}
  </label>;
}

function Secao({ titulo, detalhe }) {
  return <div className="mb-2 flex items-baseline justify-between gap-2" style={{ borderBottom: `1px solid ${T.borda}`, paddingBottom: 5 }}>
    <h2 style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".2em", textTransform: "uppercase", color: T.ouro }}>{titulo}</h2>
    {detalhe && <span style={{ fontSize: 11.5, color: T.secundario, flexShrink: 0 }}>{detalhe}</span>}
  </div>;
}

const Painel = ({ children, className = "", style }) => (
  <div className={`rounded-xl ${className}`} style={{ background: "rgba(255,255,255,0.045)", border: `1px solid ${T.borda}`, ...style }}>{children}</div>
);

function Marcadores({ jogador }) {
  return <>
    {jogador?.convidado && <span style={{ background: "rgba(192,140,255,.22)", color: T.roxo, fontSize: 9, fontWeight: 800, padding: "1px 4px", borderRadius: 3 }}>CONV</span>}
    {jogador?.pendenciaFinanceira && <span style={{ color: T.vermelho, fontWeight: 800 }} title="Pendência financeira">$</span>}
    {jogador?.pontuacaoPendente && <span style={{ color: T.secundario }} title="Pontuação pendente">(*)</span>}
  </>;
}

const Contador = ({ rotulo, valor, cor = T.texto }) => (
  <div style={{ background: "rgba(0,0,0,.25)", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
    <p style={{ fontSize: 21, fontWeight: 900, lineHeight: 1, color: cor }}>{valor}</p>
    <p style={{ fontSize: 9, marginTop: 3, letterSpacing: ".1em", textTransform: "uppercase", color: T.fraco }}>{rotulo}</p>
  </div>
);

const FaixaPartida = ({ n, extra }) => (
  <div className="flex items-center gap-2" style={{ margin: "2px 0 6px" }}>
    <span style={{ height: 1, flex: 1, background: T.borda }} />
    <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".22em", color: extra ? T.laranja : T.ouro }}>
      PARTIDA {n}{extra ? " · SOBRESSALENTES" : ""}
    </span>
    <span style={{ height: 1, flex: 1, background: T.borda }} />
  </div>
);

/** Interruptor com estado visível: trilha + botão que desliza, rótulo e explicação. */
function Interruptor({ ligado, onChange, titulo, descricao, cor = T.ouro }) {
  return (
    <button onClick={onChange} className="flex w-full items-center gap-3 rounded-lg text-left"
      style={{ padding: "10px 12px", minHeight: 52, background: ligado ? `${cor}1F` : "rgba(0,0,0,.22)", border: `1px solid ${ligado ? cor : T.borda}` }}>
      <span style={{ position: "relative", width: 42, height: 24, borderRadius: 12, flexShrink: 0, background: ligado ? cor : "rgba(255,255,255,.16)", transition: "background .15s" }}>
        <span style={{
          position: "absolute", top: 3, left: ligado ? 21 : 3, width: 18, height: 18, borderRadius: 9,
          background: ligado ? "#07204a" : "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.4)"
        }} />
      </span>
      <span className="min-w-0 flex-1">
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: ligado ? cor : T.secundario }}>{titulo}</span>
        <span style={{ display: "block", fontSize: 10.5, lineHeight: 1.35, color: T.fraco }}>{descricao}</span>
      </span>
      <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: ".1em", color: ligado ? cor : T.fraco, flexShrink: 0 }}>
        {ligado ? "SIM" : "NÃO"}
      </span>
    </button>
  );
}

/** Escolha entre duas opções mutuamente exclusivas, com a ativa em destaque. */
function Segmento({ valor, opcoes, onChange, titulo }) {
  return (
    <div>
      {titulo && <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: T.fraco }}>{titulo}</span>}
      <div className="flex gap-1 rounded-lg p-1" style={{ background: "rgba(0,0,0,.3)" }}>
        {opcoes.map((o) => {
          const ativo = valor === o.valor;
          return (
            <button key={o.valor} onClick={() => onChange(o.valor)} className="flex-1 rounded"
              style={{
                padding: "10px 4px", minHeight: 44, fontSize: 13, fontWeight: 800,
                background: ativo ? (o.cor || T.ouro) : "transparent",
                color: ativo ? "#07204a" : T.secundario
              }}>
              {o.rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Login ------------------------------------*/
/* Tela simples de e-mail + senha. Só quem consta em Authentication → Users no
 * painel do Supabase consegue entrar; o resto navega no app em modo leitura. */
function ModalLogin({ fechar, avisar }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const entrar = async () => {
    setCarregando(true); setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setCarregando(false);
    if (error) { setErro("E-mail ou senha inválidos."); return; }
    avisar("Entrou como organizador");
    fechar();
  };

  return (
    <div onClick={fechar} className="fixed inset-0 z-30 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,.65)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl p-5"
        style={{ background: T.painel, border: `1px solid ${T.borda}`, color: T.texto }}>
        <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: T.secundario, marginBottom: 12 }}>
          Entrar como organizador
        </div>
        <input type="email" placeholder="e-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus
          className="w-full rounded-md px-3 py-2" style={{ background: "#0a1b3d", color: T.texto, border: `1px solid ${T.borda}`, marginBottom: 8 }} />
        <input type="password" placeholder="senha" value={senha} onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && entrar()}
          className="w-full rounded-md px-3 py-2" style={{ background: "#0a1b3d", color: T.texto, border: `1px solid ${T.borda}`, marginBottom: 12 }} />
        {erro && <div style={{ color: T.fraco, fontSize: 12, marginBottom: 10 }}>{erro}</div>}
        <div className="flex justify-end" style={{ gap: 8 }}>
          <button onClick={fechar} style={{ padding: "8px 14px", color: T.secundario, fontSize: 13 }}>Cancelar</button>
          <button onClick={entrar} disabled={carregando || !email || !senha}
            style={{ padding: "8px 16px", borderRadius: 8, background: T.ouro, color: "#0a1b3d", fontWeight: 800, fontSize: 13, opacity: carregando ? 0.6 : 1 }}>
            {carregando ? "Entrando…" : "Entrar"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: T.secundario, marginTop: 14, lineHeight: 1.4 }}>
          Sem login, você consegue ver tabela, súmula e classificação, mas não
          consegue lançar rodadas.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ App -------------------------------------*/
export default function App() {
  const [base, setBase] = useState(null);
  const [aba, setAba] = useState("tabela");
  const [aviso, setAviso] = useState(null);
  const [sessao, setSessao] = useState(null);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const pularProximoSalvar = useRef(false);

  // Sessão de autenticação: guarda quem está logado e reage a login/logout.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Carga inicial da base.
  useEffect(() => { (async () => setBase((await carregarBase()) || baseOficial()))(); }, []);

  // Recarrega a base sempre que o app volta ao foco (troca de aba, volta do
  // segundo plano no celular). Garante que mudanças feitas em outro dispositivo
  // apareçam mesmo que o realtime não tenha entregue o evento, sem precisar
  // recarregar a página na mão.
  useEffect(() => {
    const sincronizar = async () => {
      if (document.visibilityState !== "visible") return;
      const nova = await carregarBase();
      if (nova) { pularProximoSalvar.current = true; setBase(nova); }
    };
    document.addEventListener("visibilitychange", sincronizar);
    window.addEventListener("focus", sincronizar);
    return () => {
      document.removeEventListener("visibilitychange", sincronizar);
      window.removeEventListener("focus", sincronizar);
    };
  }, []);

  // Realtime: quando outro organizador salvar, o Supabase avisa aqui e a tela
  // se atualiza sozinha. A flag `pularProximoSalvar` evita loop de gravação.
  useEffect(() => {
    const canal = supabase
      .channel("base:realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "base" }, (payload) => {
        const nova = payload.new?.dados;
        if (nova && Object.keys(nova).length) {
          pularProximoSalvar.current = true;
          setBase(migrarBase(nova));
          if (payload.new.atualizado_por && payload.new.atualizado_por !== sessao?.user?.email) {
            setAviso(`Atualizado por ${payload.new.atualizado_por}`);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [sessao?.user?.email]);

  // Salvar automático (só para quem está logado). Pula gravação quando o que
  // mudou veio de outro celular via realtime.
  useEffect(() => {
    if (!base) return;
    if (pularProximoSalvar.current) { pularProximoSalvar.current = false; return; }
    if (!sessao) return;
    const t = setTimeout(() => salvarBase(base), 250);
    return () => clearTimeout(t);
  }, [base, sessao]);

  useEffect(() => { if (aviso) { const t = setTimeout(() => setAviso(null), 3600); return () => clearTimeout(t); } }, [aviso]);

  // Se o usuário deslogar estando numa aba de gestão, volta para a Tabela.
  // (fica antes de qualquer return condicional para não quebrar a ordem dos hooks)
  useEffect(() => { if (!sessao && aba !== "tabela") setAba("tabela"); }, [sessao, aba]);

  const dados = useMemo(() => (base ? calcularClassificacao(base) : null), [base]);
  if (!base || !dados)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center" style={{ background: FUNDO_APP, color: T.secundario, gap: 14 }}>
        <img src={ESCUDO} alt="JPFFS" style={{ height: 88, width: "auto", opacity: 0.9 }} />
        <span style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase" }}>Carregando base…</span>
      </div>
    );

  const cfg = { ...CONFIG_PADRAO, ...base.config, pesos: { ...CONFIG_PADRAO.pesos, ...(base.config?.pesos || {}) } };
  const abas = [
    { id: "tabela", rotulo: "Tabela", icone: "≡" }, { id: "rodada", rotulo: "Rodada", icone: "◉" },
    { id: "elenco", rotulo: "Elenco", icone: "⚑" }, { id: "config", rotulo: "Ajustes", icone: "⚙" },
    // Jogador comum (sem login) só enxerga a Tabela. As telas de gestão só
    // aparecem para organizadores autenticados.
  ].filter((a) => sessao || a.id === "tabela");

  return (
    <div style={{ minHeight: "100vh", background: FUNDO_APP, color: T.texto, fontVariantNumeric: "tabular-nums", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
      <header className="sticky top-0 z-20 px-4 pb-2 pt-3" style={{ background: "rgba(6,20,48,.94)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${T.borda}` }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between" style={{ gap: 8 }}>
          <div style={{ width: 68 }} />
          <div className="flex flex-col items-center" style={{ gap: 2 }}>
            <img src={ESCUDO} alt="Campeonato JPFFS" style={{ height: 46, width: "auto", display: "block", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.55))" }} />
            <span style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: T.secundario }}>
              {dados.rodadasRealizadas}ª rodada · teto {dados.teto} pts
            </span>
          </div>
          <button
            onClick={() => sessao ? supabase.auth.signOut() : setMostrarLogin(true)}
            style={{
              width: 68, fontSize: 10, fontWeight: 800, letterSpacing: ".08em",
              textTransform: "uppercase", padding: "6px 8px", borderRadius: 8,
              border: `1px solid ${sessao ? T.ouro : T.borda}`,
              color: sessao ? T.ouro : T.secundario, background: "transparent",
            }}
            title={sessao ? `Logado como ${sessao.user.email}` : "Entrar como organizador"}>
            {sessao ? "Sair" : "Entrar"}
          </button>
        </div>
      </header>

      {mostrarLogin && <ModalLogin fechar={() => setMostrarLogin(false)} avisar={setAviso} />}

      {aviso && <div className="fixed left-1/2 z-30 w-11/12 max-w-sm -translate-x-1/2 rounded-lg px-4 py-3 text-center"
        style={{ bottom: 92, background: `linear-gradient(180deg,${T.ouroClaro},${T.ouro})`, color: "#0a1b3d", fontWeight: 800, fontSize: 13.5, boxShadow: "0 8px 28px rgba(0,0,0,.5)" }}>{aviso}</div>}

      <main className="mx-auto max-w-5xl px-3 pt-4" style={{ paddingBottom: 104 }}>
        {aba === "rodada" && sessao && <TelaRodada {...{ base, setBase, dados, cfg, avisar: setAviso }} />}
        {aba === "tabela" && <TelaClassificacao {...{ base, dados, cfg, avisar: setAviso }} />}
        {aba === "elenco" && sessao && <TelaElenco {...{ base, setBase, dados, cfg, avisar: setAviso }} />}
        {aba === "config" && sessao && <TelaConfig {...{ base, setBase, dados, cfg, avisar: setAviso }} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20" style={{ background: "rgba(6,20,48,.97)", borderTop: `1px solid ${T.borda}` }}>
        <div className="mx-auto flex max-w-5xl">
          {abas.map((a) => (
            <button key={a.id} onClick={() => setAba(a.id)} className="flex flex-1 flex-col items-center"
              style={{ gap: 3, padding: "11px 0 13px", color: aba === a.id ? T.ouro : T.fraco, fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>{a.icone}</span>{a.rotulo}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* =========================== TELA: RODADA ================================*/
function TelaRodada({ base, setBase, dados, cfg: cfgGlobal, avisar }) {
  const [etapa, setEtapa] = useState("presenca");
  const rodada = base.rodadas.find((r) => r.status === "aberta");
  // A rodada aberta roda com os ajustes congelados na sua abertura
  // (configSnapshot). Mudanças feitas nos Ajustes depois não a afetam.
  const cfg = rodada?.configSnapshot ? { ...CONFIG_PADRAO, ...rodada.configSnapshot } : cfgGlobal;
  const porId = Object.fromEntries(dados.todos.map((l) => [l.id, l]));
  const nomes = Object.fromEntries(base.jogadores.map((j) => [j.id, j.nome]));
  const atualizar = (patch) => setBase({ ...base, rodadas: base.rodadas.map((r) => (r.id === rodada.id ? { ...r, ...patch } : r)) });

  if (!rodada) {
    const ultima = [...base.rodadas].sort((a, b) => b.numero - a.numero)[0];
    const proxima = Math.max(dados.rodadasRealizadas, ultima?.numero || 0) + 1;
    return (
      <div className="space-y-4">
        <Painel className="p-6 text-center">
          <p style={{ fontSize: 14, color: T.secundario, marginBottom: 4 }}>Nenhuma rodada em andamento.</p>
          <p style={{ fontSize: 12, color: T.fraco, marginBottom: 20 }}>
            {ultima ? `Última no app: rodada ${ultima.numero} (${ultima.data})` : `Base oficial carregada até a ${base.historicoInicial?.rodadas || 0}ª rodada.`}
          </p>
          <Botao className="w-full" onClick={() => {
            // Snapshot dos ajustes vigentes NO MOMENTO da abertura. A rodada usa
            // esses valores até ser fechada; mudanças posteriores nos Ajustes só
            // valem para as próximas rodadas, nunca para esta nem para as antigas.
            setBase({ ...base, rodadas: [...base.rodadas, { id: id(), numero: proxima, data: new Date().toISOString().slice(0, 10), status: "aberta", presencas: {}, naLinha: {}, times: [], jogos: [], ajustes: [], configSnapshot: { ...cfg } }] });
            avisar(`Rodada ${proxima} aberta`);
          }}>Abrir rodada {proxima}</Botao>
        </Painel>
        <Historico {...{ base, setBase, avisar, nomes, dados }} />
      </div>
    );
  }

  const etapas = [
    { id: "presenca", r: "Presença" }, { id: "times", r: "Sorteio" },
    { id: "jogos", r: `Partidas${rodada.jogos.length ? ` (${rodada.jogos.length})` : ""}` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: T.ouroFraco, border: "1px solid rgba(245,197,24,.34)" }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <button
            onClick={() => {
              const temLancamento = (rodada.jogos || []).length > 0 || Object.keys(rodada.presencas || {}).length > 0;
              const msg = temLancamento
                ? `Fechar a rodada ${rodada.numero} e voltar? As presenças/partidas ainda não fechadas desta rodada serão descartadas.`
                : `Voltar para a tela de abertura? A rodada ${rodada.numero} (ainda vazia) será cancelada.`;
              if (confirm(msg)) {
                setBase({ ...base, rodadas: base.rodadas.filter((r) => r.id !== rodada.id) });
                avisar("Voltou para a abertura de rodada");
              }
            }}
            title="Voltar para abrir rodada"
            style={{ fontSize: 18, fontWeight: 900, color: T.ouro, lineHeight: 1, padding: "2px 6px" }}>‹</button>
          <div>
            <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase", color: T.ouro }}>Rodada {rodada.numero}</p>
            <p style={{ fontSize: 12, color: T.secundario }}>{rodada.jogos.length} partida(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <input type="number" value={rodada.numero} onChange={(e) => atualizar({ numero: Number(e.target.value) })} style={{ ...inputStyle, width: 58, padding: "8px 4px", textAlign: "center", fontSize: 13 }} />
          <input type="date" value={rodada.data} onChange={(e) => atualizar({ data: e.target.value })} style={{ ...inputStyle, width: "auto", padding: "8px", fontSize: 12 }} />
        </div>
      </div>

      <div className="flex gap-1 rounded-lg p-1" style={{ background: "rgba(0,0,0,.3)" }}>
        {etapas.map((e) => (
          <button key={e.id} onClick={() => setEtapa(e.id)} className="flex-1 rounded"
            style={{
              padding: "11px 4px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
              background: etapa === e.id ? `linear-gradient(180deg,${T.ouroClaro},${T.ouro})` : "transparent", color: etapa === e.id ? "#0a1b3d" : T.secundario
            }}>{e.r}</button>
        ))}
      </div>

      {etapa === "presenca" && <EtapaPresenca {...{ base, setBase, rodada, atualizar, porId, cfg, dados, avisar, ir: () => setEtapa("times") }} />}
      {etapa === "times" && <EtapaSorteio {...{ base, rodada, atualizar, porId, cfg, dados, avisar, nomes, ir: () => setEtapa("jogos") }} />}
      {etapa === "jogos" && <EtapaJogos {...{ base, rodada, atualizar, cfg, dados, avisar, nomes, porId }} />}
    </div>
  );
}

/* --- pools do dia (compartilhado entre etapas) ---------------------------*/
function poolsDoDia(base, rodada, porId, dados, cfg) {
  const statusDe = (jid) => rodada.presencas[jid] || "ausente";
  const presentes = base.jogadores.filter((j) => j.ativo !== false && ["presente", "atrasado"].includes(statusDe(j.id)));
  const info = presentes.map((j) => {
    const nivel = statusDe(j.id) === "atrasado" ? nivelSeAtrasar(dados.disciplina, rodada, j.id) : 0;
    return { jogador: j, nivel, suspenso: nivel >= cfg.atrasosParaSuspensao, linha: porId[j.id] };
  });
  const aptos = info.filter((e) => !e.suspenso);
  return {
    info, aptos,
    suspensos: info.filter((e) => e.suspenso),
    goleiros: aptos.filter((e) => e.jogador.posicao === "GOLEIRO"),
    linha: aptos.filter((e) => e.jogador.posicao !== "GOLEIRO"),
  };
}

/** Quantas partidas dá para montar. Conta pelos jogadores de LINHA: a vaga de
 *  goleiro pode sair em aberto e ser completada manualmente. */
/** Quantas partidas a rodada gera. Regra do campeonato: TODA partida é 8 de
 *  linha + 2 goleiros. O número de partidas é o necessário para acomodar tanto
 *  a linha (8 por partida) quanto os goleiros (2 por partida) — o que exigir
 *  mais partidas manda. As vagas que faltarem (de linha ou de gol) ficam
 *  abertas nas últimas partidas, para completar na mão.
 *  Ex.: 18L+2G → máx(⌈18/8⌉,⌈2/2⌉)=3 · 12L+3G → máx(2,2)=2 · 20L+4G → 3. */
function partidasPossiveis(nLinha, nGoleiros, cfg) {
  const linhaPorTime = cfg.jogadoresPorTime - cfg.goleirosPorTime; // 4
  const gkPorTime = cfg.goleirosPorTime;                            // 1
  const porLinha = linhaPorTime * 2;   // 8 de linha por partida
  const porGk = gkPorTime * 2;         // 2 goleiros por partida
  const necessariasLinha = Math.ceil(nLinha / porLinha);
  const necessariasGk = Math.ceil(nGoleiros / porGk);
  return Math.min(3, Math.max(necessariasLinha, necessariasGk));
}

/* --------------------- Etapa 1: presença ---------------------------------*/
function EtapaPresenca({ base, setBase, rodada, atualizar, porId, cfg, dados, avisar, ir }) {
  const [busca, setBusca] = useState("");
  const [conv, setConv] = useState({ nome: "", posicao: "LINHA", estrelas: 1 });
  const ciclo = { ausente: "presente", presente: "atrasado", atrasado: "ausente" };
  const statusDe = (jid) => rodada.presencas[jid] || "ausente";
  const P = poolsDoDia(base, rodada, porId, dados, cfg);
  const partidas = partidasPossiveis(P.linha.length, P.goleiros.length, cfg);
  const linhaPorTime = cfg.jogadoresPorTime - cfg.goleirosPorTime;
  // Vagas de cada tipo nas N partidas e quantas ficam abertas para completar na
  // mão. Linha: 8 por partida; gol: 2 por partida.
  const vagasLinhaTot = partidas * linhaPorTime * 2;
  const vagasGkTot = partidas * cfg.goleirosPorTime * 2;
  const faltamLinha = Math.max(0, vagasLinhaTot - P.linha.length);
  const vagasGkAbertas = Math.max(0, vagasGkTot - P.goleiros.length);
  const faltamCompletar = faltamLinha + vagasGkAbertas;
  const dist = [5, 4, 3, 2, 1].map((e) => ({ e, n: P.aptos.filter((a) => (a.linha?.estrelas || 1) === e).length })).filter((d) => d.n);

  // Ordenação alfabética e separação em 3 grupos apenas para organizar a
  // visualização da chamada: A–I, J–R e S–Z. Não altera nenhuma regra.
  const visiveis = base.jogadores.filter((j) => j.ativo !== false)
    .filter((j) => j.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const primeiraLetra = (nome) => (nome || "").trim().charAt(0).toUpperCase();
  const gruposChamada = [
    { titulo: "A – I", jogadores: visiveis.filter((j) => primeiraLetra(j.nome) >= "A" && primeiraLetra(j.nome) <= "I") },
    { titulo: "J – R", jogadores: visiveis.filter((j) => primeiraLetra(j.nome) >= "J" && primeiraLetra(j.nome) <= "R") },
    { titulo: "S – Z", jogadores: visiveis.filter((j) => primeiraLetra(j.nome) >= "S") },
  ].filter((g) => g.jogadores.length > 0);

  return (
    <div className="space-y-4">
      {/* Ajustes vigentes nesta rodada (congelados na abertura). */}
      <Painel className="p-3" style={{ background: "rgba(240,192,64,.06)", borderColor: "rgba(240,192,64,.25)" }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".14em", color: T.ouro, marginBottom: 6 }}>AJUSTES DESTA RODADA</div>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {[
            `Teto ${cfg.tetoPorRodada} pts/rodada`,
            `${cfg.jogadoresPorTime - cfg.goleirosPorTime} de linha + ${cfg.goleirosPorTime} gk por time`,
            `Supercopa: ${cfg.zonaSupercopa} linha + ${cfg.goleirosSupercopa || 2} gk`,
            `Cartões: ${cfg.cartoesPorPonto} = 1 ponto`,
          ].map((t, i) => (
            <span key={i} style={{ fontSize: 10.5, fontWeight: 700, color: T.secundario, background: "rgba(255,255,255,.05)", padding: "4px 9px", borderRadius: 20 }}>{t}</span>
          ))}
        </div>
      </Painel>

      <Painel className="grid grid-cols-5 gap-1.5 p-2">
        <Contador rotulo="Aptos" valor={P.aptos.length} cor={T.verde} />
        <Contador rotulo="Goleiros" valor={P.goleiros.length} cor={T.gk} />
        <Contador rotulo="Linha" valor={P.linha.length} />
        <Contador rotulo="Partidas" valor={partidas} cor={partidas >= 1 ? T.ouro : T.laranja} />
        <Contador rotulo="Completar" valor={faltamCompletar} cor={faltamCompletar > 0 ? T.laranja : T.fraco} />
      </Painel>

      {partidas >= 1 && vagasGkAbertas > 0 && (
        <Painel className="p-3" style={{ borderColor: T.laranja, background: "rgba(255,165,61,.12)", fontSize: 12, color: T.secundario }}>
          <b style={{ color: T.laranja }}>{P.goleiros.length} goleiro(s) para {partidas * 2} equipes.</b> {vagasGkAbertas} equipe(s)
          sairão com a <b style={{ color: T.gk }}>vaga de meta em aberto</b> — você escolhe na hora quem completa no gol.
          O sorteio não promove jogador de linha a goleiro nem coloca dois goleiros na mesma equipe.
        </Painel>
      )}

      {dist.length > 0 && (
        <p className="rounded-lg px-3 py-2" style={{ background: "rgba(0,0,0,.22)", fontSize: 12, color: T.secundario }}>
          <b style={{ color: T.ouro }}>Distribuição:</b> {dist.map((d) => `${d.n} de ${d.e}★`).join(" · ")}
        </p>
      )}

      {P.suspensos.length > 0 && (
        <Painel className="p-3" style={{ borderColor: T.vermelho, background: "rgba(255,107,107,.1)", fontSize: 12, color: T.secundario }}>
          <b style={{ color: T.vermelho }}>Suspensos (§8º d):</b>{" "}
          {P.suspensos.map((e) => `${e.jogador.nome} (${e.nivel}º atraso)`).join(", ")}. Perdem a presença e ficam fora do sorteio.
        </Painel>
      )}

      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar jogador…" style={inputStyle} />

      <section>
        <Secao titulo="Chamada" detalhe="ausente → presente → atrasado" />
        <div className="space-y-4">
          {gruposChamada.map((grupo) => (
            <div key={grupo.titulo}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".14em", color: T.ouro, marginBottom: 8, opacity: 0.85 }}>{grupo.titulo}</div>
              <div className="flex flex-wrap gap-2">
                {grupo.jogadores.map((j) => {
                  const s = statusDe(j.id), l = porId[j.id];
                  const nivel = s === "atrasado" ? nivelSeAtrasar(dados.disciplina, rodada, j.id) : 0;
                  const proximo = nivelSeAtrasar(dados.disciplina, rodada, j.id);
                  const susp = nivel >= cfg.atrasosParaSuspensao;
                  const est = susp ? { border: T.vermelho, background: "rgba(255,107,107,.18)", color: T.vermelho }
                    : s === "presente" ? { border: T.verde, background: "rgba(61,214,140,.16)", color: T.verde }
                      : s === "atrasado" ? { border: T.laranja, background: "rgba(255,165,61,.16)", color: T.laranja }
                        : { border: T.borda, background: "rgba(255,255,255,.04)", color: T.secundario };
                  return (
                    <button key={j.id} onClick={() => {
                      const novo = ciclo[s];
                      atualizar({ presencas: { ...rodada.presencas, [j.id]: novo } });
                      if (novo === "atrasado") avisar(`${j.nome}: ${nivelInfo(proximo, cfg).rotulo}`);
                    }} className="flex items-center gap-1.5 rounded-full"
                      style={{ padding: "10px 14px", minHeight: 44, fontSize: 14, fontWeight: 600, border: `1px solid ${est.border}`, background: est.background, color: est.color }}>
                      {susp && "🚫"}
                      {j.posicao === "GOLEIRO" && <IconeGoleiro tam={14} />}
                      {j.nome}
                      <Estrelas n={l?.estrelas || 1} tam={9} goleiro={j.posicao === "GOLEIRO"} />
                      {nivel > 0 && <SeloAtraso nivel={nivel} cfg={cfg} mini />}
                      <Marcadores jogador={j} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <Secao titulo="Convidado / avulso" detalhe="joga, mas fica fora da tabela" />
        <Painel className="flex gap-1.5 p-3">
          <input value={conv.nome} onChange={(e) => setConv({ ...conv, nome: e.target.value })} placeholder="Nome" style={{ ...inputStyle, flex: 1, padding: "10px 8px", fontSize: 14 }} />
          <select value={conv.posicao} onChange={(e) => setConv({ ...conv, posicao: e.target.value })} style={{ ...inputStyle, width: "auto", padding: "10px 4px", fontSize: 12 }}>
            <option value="LINHA">Linha</option><option value="GOLEIRO">Gol</option>
          </select>
          <select value={conv.estrelas} onChange={(e) => setConv({ ...conv, estrelas: Number(e.target.value) })} style={{ ...inputStyle, width: "auto", padding: "10px 4px", fontSize: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★</option>)}
          </select>
          <Botao style={{ padding: "0 16px" }} onClick={() => {
            if (!conv.nome.trim()) return;
            const jid = id();
            setBase({
              ...base,
              jogadores: [...base.jogadores, { id: jid, nome: conv.nome.trim(), posicao: conv.posicao, ativo: true, convidado: true, estrelasIniciais: conv.estrelas }],
              rodadas: base.rodadas.map((r) => r.id === rodada.id ? { ...r, presencas: { ...r.presencas, [jid]: "presente" } } : r),
            });
            avisar(`${conv.nome.trim()} entrou como convidado`);
            setConv({ nome: "", posicao: "LINHA", estrelas: 1 });
          }}>+</Botao>
        </Painel>
      </section>

      <Botao className="w-full" disabled={partidas < 1} onClick={ir}>
        {partidas >= 1 ? `Sortear ${partidas} partida(s)` : `Nenhum jogador presente ainda`}
      </Botao>
    </div>
  );
}

/* --------------------- Etapa 2: sorteio ----------------------------------*/
function EtapaSorteio({ base, rodada, atualizar, porId, cfg, dados, avisar, nomes, ir }) {
  // O rascunho do sorteio (antes de "Gravar partidas") mora na própria rodada,
  // não num useState local — assim ele sobrevive a trocar de aba (Presença ⇄
  // Sorteio) e até a fechar o app. Sem isso, só olhar quem chegou atrasado na
  // etapa Presença jogava fora o time inteiro que já estava sendo montado.
  const sorteio = rodada.sorteioRascunho || null;
  const setSorteio = (valor) => atualizar({ sorteioRascunho: valor });
  const [travas, setTravas] = useState({});
  const [sel, setSel] = useState(null);
  const [nPartidas, setNPartidas] = useState(0);

  const P = poolsDoDia(base, rodada, porId, dados, cfg);
  const maxPartidas = partidasPossiveis(P.linha.length, P.goleiros.length, cfg);
  const alvo = nPartidas || maxPartidas;

  /* Reconciliação: se alguém do rascunho deixou de estar apto (marcado
   * ausente, ou virou suspenso por atraso) enquanto o usuário estava em outra
   * etapa, a vaga dessa pessoa esvazia sozinha ao voltar — sem mexer em mais
   * ninguém. Chegadas novas (presente/atrasado) não entram sozinhas: ficam
   * disponíveis para escolher manualmente em qualquer vaga aberta. */
  useEffect(() => {
    if (!sorteio) return;
    const aptosIds = new Set(P.aptos.map((e) => e.jogador.id));
    let mudou = false;
    const partidas = sorteio.partidas.map((p) => {
      const limpar = (lado) => {
        let alterado = false;
        const vagas = lado.vagas.map((v) => {
          if (v.jogador && !aptosIds.has(v.jogador.id)) { alterado = true; return { ...v, jogador: null }; }
          return v;
        });
        if (!alterado) return lado;
        mudou = true;
        return { ...lado, vagas, forca: vagas.reduce((s, v) => s + (v.jogador?.estrelas || 0), 0) };
      };
      return { ...p, amarelo: limpar(p.amarelo), azul: limpar(p.azul) };
    });
    if (mudou) { setSorteio({ ...sorteio, partidas }); avisar("Alguém saiu da chamada — a vaga dela(e) no sorteio ficou em aberto"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodada.presencas]);

  // quantas vezes cada um já apareceu em partidas gravadas nesta rodada
  const aparicoes = {};
  for (const g of rodada.jogos)
    for (const t of [timePorId(rodada, g.timeA), timePorId(rodada, g.timeB)])
      for (const j of t?.jogadores || []) aparicoes[j.jogadorId] = (aparicoes[j.jogadorId] || 0) + 1;

  const entradas = () => P.aptos.map(({ jogador: j, linha: l }) => ({
    id: j.id, nome: j.nome, ehGoleiro: j.posicao === "GOLEIRO", convidado: !!j.convidado,
    estrelas: j.convidado ? j.estrelasIniciais || 1 : l?.estrelas || 1,
    aproveitamento: l?.aproveitamento || 0, posicaoTabela: l?.posicao || 999,
    prioridade: aparicoes[j.id] || 0,
  }));

  const duplasRecentes = () => {
    const m = new Map();
    [...base.rodadas].filter((r) => r.numero < rodada.numero && (r.times || []).length)
      .sort((a, b) => b.numero - a.numero).slice(0, cfg.rodadasAntiRepeticao)
      .forEach((r, idx) => {
        const peso = cfg.rodadasAntiRepeticao - idx;
        for (const t of r.times || []) {
          const e = idsDoTime(t);
          for (let i = 0; i < e.length; i++) for (let k = i + 1; k < e.length; k++)
            m.set(chaveDupla(e[i], e[k]), (m.get(chaveDupla(e[i], e[k])) || 0) + peso);
        }
      });
    return m;
  };

  function executar(seed) {
    const r = sortearEquipes(entradas(), {
      ...cfg, seed, partidas: alvo, travas,
      restricoes: base.restricoes || [], duplasRecentes: duplasRecentes(),
    });
    if (r.erro) return avisar(r.erro);
    setSorteio(r); setSel(null);
    const contaVazias = (p) => [p.amarelo, p.azul].reduce((s, e) => s + e.vagas.filter((v) => !v.jogador).length, 0);
    const incompleta = r.partidas.find((p) => contaVazias(p) > 0);
    const buracos = incompleta ? contaVazias(incompleta) : 0;
    avisar(buracos > 0
      ? `Sorteado · a partida ${incompleta.numero} tem ${buracos} vaga(s) para completar`
      : `${r.partidas.length} partida(s) sorteada(s)`);
  }

  const jogadoresDaPartida = (p) => [p.amarelo, p.azul].flatMap((e) => e.vagas.map((v) => v.jogador).filter(Boolean));
  const contarVazias = (p) => [p.amarelo, p.azul].reduce((s, e) => s + e.vagas.filter((v) => !v.jogador).length, 0);

  // equilíbrio calculado só nas partidas SEM vagas em aberto — a incompleta,
  // que ainda vai ser completada na mão, costuma ficar desigual
  const diag = useMemo(() => {
    if (!sorteio) return null;
    const completas = sorteio.partidas.filter((p) => contarVazias(p) === 0);
    const base2 = completas.length ? completas : sorteio.partidas;
    const times = base2.flatMap((p) => [p.amarelo, p.azul]).map((e) => e.vagas.map((v) => v.jogador).filter(Boolean).filter((j) => !j.naoPontua));
    const todos = times.flat();
    if (!todos.length) return { indiceEquilibrio: 0, amplitude: 0, desvio: 0, violacoes: [] };
    return avaliarTimes(times, {
      pesos: cfg.pesos, goleirosPorTime: cfg.goleirosPorTime, goleirosSuficientes: false,
      totalCinco: todos.filter((j) => j.estrelas === 5).length, duplasRecentes: null,
      restricoes: (base.restricoes || []).filter((r) => todos.some((j) => j.id === r.a) && todos.some((j) => j.id === r.b)),
      usarAproveitamento: cfg.usarAproveitamento, travados: new Set(),
      nome: (x) => nomes[x] || "?", nomeTime: (i) => `Time ${i + 1}`,
    });
  }, [sorteio, cfg, base.restricoes, nomes]);

  /** Aplica uma mudança nas vagas e recalcula a força da equipe. */
  function mexer(fn) {
    const partidas = sorteio.partidas.map((p) => ({
      ...p,
      amarelo: { ...p.amarelo, vagas: p.amarelo.vagas.map((v) => ({ ...v })) },
      azul: { ...p.azul, vagas: p.azul.vagas.map((v) => ({ ...v })) },
    }));
    fn(partidas);
    for (const p of partidas) for (const lado of ["amarelo", "azul"]) {
      const e = p[lado];
      // Quem foi marcado como "não pontua" (§10, escolhido à mão só pra
      // completar) não entra na força/equilíbrio — ele não está de fato
      // disputando a partida.
      e.forca = e.vagas.reduce((s, v) => s + (v.jogador && !v.jogador.naoPontua ? v.jogador.estrelas : 0), 0);
    }
    setSorteio({ ...sorteio, partidas });
  }

  /** Quantos goleiros de ofício a equipe tem, ignorando uma vaga específica. */
  const contarGoleiros = (equipe, exceto) =>
    equipe.vagas.filter((v) => v !== exceto && v.jogador?.ehGoleiro).length;

  function trocar(a, b) {
    setSel(null);
    if (!a || !b || a === b) return;
    // Não permite mover quem está na partida onde pontua (1ª aparição). Só quem
    // repete (entrou para completar) pode ser trocado.
    const primeira = {};
    for (const q of sorteio.partidas) for (const e of [q.amarelo, q.azul]) for (const v of e.vagas)
      if (v.jogador) { const at = primeira[v.jogador.id]; if (at === undefined || q.numero < at) primeira[v.jogador.id] = q.numero; }
    const posicaoDe = (id) => {
      for (const q of sorteio.partidas) for (const e of [q.amarelo, q.azul]) for (const v of e.vagas)
        if (v.jogador?.id === id) return q.numero;
      return null;
    };
    // Escolhido à mão para completar uma vaga em aberto nunca trava — precisa
    // sempre poder ser movido/trocado, mesmo sendo a "primeira" aparição dele.
    const ehManual = (id) => {
      for (const q of sorteio.partidas) for (const e of [q.amarelo, q.azul]) for (const v of e.vagas)
        if (v.jogador?.id === id) return !!v.jogador.manual;
      return false;
    };
    const travado = (id) => primeira[id] === posicaoDe(id) && !aparicoes[id] && !ehManual(id);
    if (travado(a) || travado(b)) { avisar("Jogador bloqueado 🔒 — está na partida em que pontua"); return; }
    let recusa = null;
    mexer((partidas) => {
      let va = null, vb = null, ea = null, eb = null;
      for (const p of partidas) for (const lado of ["amarelo", "azul"])
        for (const v of p[lado].vagas) {
          if (v.jogador?.id === a) { va = v; ea = p[lado]; }
          if (v.jogador?.id === b) { vb = v; eb = p[lado]; }
        }
      if (!va || !vb) return;
      if (va.papel !== vb.papel) { recusa = "Vaga de goleiro só troca com vaga de goleiro."; return; }
      if (ea !== eb) {
        // a troca não pode juntar dois goleiros de ofício numa equipe
        const aposA = contarGoleiros(ea, va) + (vb.jogador?.ehGoleiro ? 1 : 0);
        const aposB = contarGoleiros(eb, vb) + (va.jogador?.ehGoleiro ? 1 : 0);
        if (aposA > cfg.goleirosPorTime || aposB > cfg.goleirosPorTime) {
          recusa = "Recusado: deixaria dois goleiros na mesma equipe.";
          return;
        }
      }
      const tmp = va.jogador; va.jogador = vb.jogador; vb.jogador = tmp;
    });
    if (recusa) avisar(recusa);
  }

  function definirVaga(pi, lado, vi, jid) {
    let recusa = null;
    mexer((partidas) => {
      const equipe = partidas[pi][lado];
      const vaga = equipe.vagas[vi];
      if (!jid) { vaga.jogador = null; return; }
      const dados = P.aptos.find((e) => e.jogador.id === jid);
      if (!dados) return;
      const { jogador: j, linha: l } = dados;
      const ehGk = j.posicao === "GOLEIRO";
      if (ehGk && contarGoleiros(equipe, vaga) >= cfg.goleirosPorTime) {
        recusa = `${j.nome} é goleiro e esta equipe já tem um.`;
        return;
      }
      vaga.jogador = {
        id: j.id, nome: j.nome, ehGoleiro: ehGk, convidado: !!j.convidado,
        estrelas: j.convidado ? j.estrelasIniciais || 1 : l?.estrelas || 1,
        posicaoTabela: l?.posicao || 999, slotGoleiro: vaga.papel === "GOLEIRO",
        // Escolhido à mão para completar uma vaga que ficou em aberto: nunca
        // pontua (§10º) e nunca trava — sempre dá pra apagar e escolher de
        // novo se clicou errado.
        manual: true, naoPontua: true,
      };
    });
    if (recusa) avisar(recusa);
  }

  /** Preenche as vagas em aberto de uma partida. Primeiro usa quem ainda não
   *  entrou em nenhuma partida; se acabarem, completa REUTILIZANDO quem já
   *  jogou (priorizando quem apareceu menos vezes). Quem repete não pontua
   *  nada — nem cartão —, o que é tratado na hora de gravar/pontuar. */
  function completarAutomaticamente(numeroPartida) {
    let preencheu = 0;
    mexer((partidas) => {
      const alvos = numeroPartida ? partidas.filter((p) => p.numero === numeroPartida) : partidas;

      // Uso atual de cada jogador considerando o sorteio na tela (quantas
      // partidas já ocupa). Serve para priorizar quem aparece menos.
      const usoAtual = () => {
        const m = {};
        for (const q of partidas) for (const e of [q.amarelo, q.azul])
          for (const x of e.vagas) if (x.jogador) m[x.jogador.id] = (m[x.jogador.id] || 0) + 1;
        return m;
      };

      for (const p of alvos) for (const lado of ["amarelo", "azul"]) {
        const equipe = p[lado];
        for (const vaga of equipe.vagas) {
          if (vaga.jogador) continue;
          const querGk = vaga.papel === "GOLEIRO";
          const jaTemGk = contarGoleiros(equipe, vaga) >= cfg.goleirosPorTime;

          // Quem já está NESTA partida não pode ocupar outra vaga dela.
          const nestaPartida = new Set([p.amarelo, p.azul]
            .flatMap((e) => e.vagas.map((x) => x.jogador?.id).filter(Boolean)));

          const uso = usoAtual();
          // Candidatos = todos os aptos que ainda não estão nesta partida.
          // Para completar, reutilizamos quem já jogou (vem das outras partidas);
          // se houver alguém ainda de fora, entra primeiro. Prioridade: quem
          // apareceu menos vezes no dia. Vaga de goleiro pode ser completada com
          // qualquer jogador (goleiro ou de linha), como na regra do campeonato.
          const candidatos = P.aptos
            .filter((e) => !nestaPartida.has(e.jogador.id))
            .filter((e) => {
              const ehGk = e.jogador.posicao === "GOLEIRO";
              // não colocar um 2º goleiro de ofício na mesma equipe
              if (jaTemGk && ehGk) return false;
              return true;
            })
            .sort((a, b) => {
              const ua = (uso[a.jogador.id] || 0) + (aparicoes[a.jogador.id] || 0);
              const ub = (uso[b.jogador.id] || 0) + (aparicoes[b.jogador.id] || 0);
              if (ua !== ub) return ua - ub; // quem jogou menos primeiro
              // desempate: para vaga de goleiro, prefere goleiro de ofício
              if (querGk) {
                const ga = a.jogador.posicao === "GOLEIRO" ? 0 : 1;
                const gb = b.jogador.posicao === "GOLEIRO" ? 0 : 1;
                if (ga !== gb) return ga - gb;
              }
              return 0;
            });

          const e = candidatos[0];
          if (!e) continue;
          const l = e.linha;
          vaga.jogador = {
            id: e.jogador.id, nome: e.jogador.nome, ehGoleiro: e.jogador.posicao === "GOLEIRO",
            convidado: !!e.jogador.convidado,
            estrelas: e.jogador.convidado ? e.jogador.estrelasIniciais || 1 : l?.estrelas || 1,
            posicaoTabela: l?.posicao || 999, slotGoleiro: vaga.papel === "GOLEIRO",
            manual: true, naoPontua: true,
          };
          preencheu++;
        }
      }
    });
    avisar(preencheu > 0
      ? `${preencheu} vaga(s) completada(s) com quem jogou menos`
      : "Não há quem completar — todos já estão nesta partida");
  }


  const vaziasTotal = sorteio ? sorteio.partidas.reduce((s, p) => s + contarVazias(p), 0) : 0;

  function gravar() {
    // Substitui as partidas da rodada: recomeça do zero a cada gravação, para
    // não empilhar sorteios antigos. A numeração recomeça em 1.
    const times = [], jogos = [];
    sorteio.partidas.forEach((p, i) => {
      const criar = (lado) => {
        const t = {
          id: id(), partida: p.numero, cor: lado.cor, chave: lado.chave, seed: sorteio.seed,
          extra: !!p.extra,
          jogadores: lado.vagas.filter((v) => v.jogador).map((v) => ({
            jogadorId: v.jogador.id, estrelaNoSorteio: v.jogador.estrelas,
            atuaComoGoleiro: v.papel === "GOLEIRO",
          })),
          // Vagas que sobraram sem jogador: ficam registradas no time gravado
          // para serem completadas depois, na etapa Partidas — sem precisar
          // desfazer o sorteio (Art. 34º §14º/§17º).
          vagasAbertas: lado.vagas.filter((v) => !v.jogador).map((v) => v.papel),
        };
        times.push(t); return t.id;
      };
      const a = criar(p.amarelo), b = criar(p.azul);
      // Quem foi marcado com §10 na tela de sorteio (completou a vaga aberta,
      // mas o organizador decidiu que não pontua) já entra gravado como
      // soCartoes — marcarReaproveitamentos só ACRESCENTA a isso, nunca apaga.
      const soCartoesManual = [p.amarelo, p.azul].flatMap((e) => e.vagas.filter((v) => v.jogador?.naoPontua).map((v) => v.jogador.id));
      jogos.push({
        id: id(), numero: i + 1, timeA: a, timeB: b,
        golsContraA: 0, golsContraB: 0, golsNaoComputadosA: 0, golsNaoComputadosB: 0, placarManual: null, encerrado: false, completaTime: [], soCartoes: soCartoesManual, eventos: {}
      });
    });
    const nova = { ...rodada, times, jogos };
    // Um único atualizar(): sorteioRascunho precisa ir junto no mesmo patch,
    // senão essa segunda chamada (feita com o `rodada` desta renderização,
    // já desatualizado) apagaria o times/jogos gravados pela primeira.
    atualizar({ times: nova.times, jogos: marcarReaproveitamentos(nova), sorteioRascunho: null });
    setTravas({});
    avisar(`${sorteio.partidas.length} partida(s) gravada(s)`);
    ir();
  }

  const CardTime = ({ p, pi, lado }) => {
    const time = p[lado];
    const idsNaPartida = new Set(jogadoresDaPartida(p).map((j) => j.id));

    // Trava (cadeado): um jogador está na 1ª APARIÇÃO — a partida onde ele
    // pontua — se este é o menor número de partida em que ele aparece no
    // sorteio atual. Nessa vaga ele não pode ser removido nem trocado. Nas
    // partidas seguintes (repetições, entrou só para completar) fica editável.
    const primeiraAparicao = {};
    for (const q of sorteio.partidas)
      for (const e of [q.amarelo, q.azul])
        for (const v of e.vagas)
          if (v.jogador) {
            const at = primeiraAparicao[v.jogador.id];
            if (at === undefined || q.numero < at) primeiraAparicao[v.jogador.id] = q.numero;
          }

    return (
      <div className="rounded-lg p-2" style={{ background: "rgba(0,0,0,.28)", borderTop: `4px solid ${time.hex}` }} onDragOver={(e) => e.preventDefault()}>
        <div className="mb-2 flex items-baseline justify-between">
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".1em", color: time.hex }}>{time.cor}</span>
          <span style={{ fontSize: 11, color: T.secundario }}>{time.forca}★</span>
        </div>
        <ul className="space-y-1">
          {time.vagas.map((v, vi) => {
            const j = v.jogador;
            if (!j) {
              const jaTemGk = contarGoleiros(time, v) >= cfg.goleirosPorTime;
              const opcoes = P.aptos
                .filter((e) => !idsNaPartida.has(e.jogador.id))
                .filter((e) => !(jaTemGk && e.jogador.posicao === "GOLEIRO"))
                .sort((a, b) => (aparicoes[a.jogador.id] || 0) - (aparicoes[b.jogador.id] || 0)
                  || a.jogador.nome.localeCompare(b.jogador.nome, "pt-BR"));
              return (
                <li key={`v${vi}`} className="rounded" style={{ background: "rgba(255,165,61,.1)", border: `1px dashed ${T.laranja}`, padding: 5 }}>
                  <div className="mb-1 flex items-center gap-1">
                    {v.papel === "GOLEIRO" ? <IconeGoleiro tam={12} /> : <span style={{ fontSize: 10, color: T.laranja }}>▢</span>}
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".06em", color: T.laranja }}>
                      VAGA DE {v.papel}
                    </span>
                  </div>
                  <select value="" onChange={(e) => definirVaga(pi, lado, vi, e.target.value)}
                    style={{ ...inputStyle, padding: "7px 4px", fontSize: 11.5 }}>
                    <option value="">— escolher —</option>
                    {opcoes.map(({ jogador: o, linha: l }) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}{o.posicao === "GOLEIRO" ? " (GK)" : ""} · {l?.estrelas || 1}★
                        {aparicoes[o.id] ? " · já jogou" : ""}
                      </option>
                    ))}
                  </select>
                </li>
              );
            }
            const noGol = v.papel === "GOLEIRO";
            const repetido = !!aparicoes[j.id];
            const naoPontua = !!j.naoPontua;
            // Travado = está na partida onde pontua (1ª aparição no sorteio),
            // não é reaproveitamento de partida já gravada, E não foi um
            // preenchimento manual de vaga aberta — esse último nunca trava,
            // pra sempre dar pra desfazer um clique errado.
            const travado = primeiraAparicao[j.id] === p.numero && !repetido && !j.manual;
            const semPontuar = repetido || naoPontua;
            return (
              <li key={j.id} draggable={!travado}
                onDragStart={(e) => { if (travado) { e.preventDefault(); return; } e.dataTransfer.setData("text/plain", j.id); }}
                onDrop={(e) => { e.preventDefault(); if (!travado) trocar(e.dataTransfer.getData("text/plain"), j.id); }}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => { if (travado) return; sel === null ? setSel(j.id) : sel === j.id ? setSel(null) : trocar(sel, j.id); }}
                className={`flex items-center justify-between gap-1 rounded ${travado ? "" : "cursor-pointer"}`}
                style={{
                  padding: "7px 6px", fontSize: 12.5, minHeight: 36,
                  background: sel === j.id ? T.ouroFraco : noGol ? T.gkFraco : "transparent",
                  outline: sel === j.id ? `1px solid ${T.ouro}` : noGol ? `1px solid ${T.gk}` : "none",
                  opacity: travado ? 0.92 : 1
                }}>
                <span className="flex min-w-0 items-center gap-1" style={{ color: semPontuar ? T.fraco : T.texto, fontStyle: semPontuar ? "italic" : "normal" }}>
                  {noGol && <IconeGoleiro tam={13} />}
                  <span className="truncate">{j.nome}</span>
                  {travado && <span title="Está na partida em que pontua — bloqueado para não desfazer a escalação que vale" style={{ fontSize: 11 }}>🔒</span>}
                  {repetido && <span title="Já jogou nesta rodada — aqui só preenche a vaga, não pontua nada" style={{ fontSize: 8, fontWeight: 800, color: T.laranja }}>REPETE</span>}
                  {!repetido && naoPontua && <span title="Completou uma vaga que estava em aberto (§10º) — não pontua nada" style={{ fontSize: 8, fontWeight: 800, color: T.laranja }}>COMPLETA</span>}
                  {j.convidado && <span style={{ fontSize: 8, color: T.roxo }}>CONV</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Estrelas n={j.estrelas} tam={9} goleiro={j.ehGoleiro} />
                  {!travado && (
                    <button onClick={(e) => { e.stopPropagation(); definirVaga(pi, lado, vi, null); }}
                      title="Esvaziar a vaga" style={{ color: "rgba(255,255,255,.25)", fontSize: 12 }}>✕</button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {rodada.jogos.length > 0 && (
        <Painel className="p-3" style={{ fontSize: 11.5, color: T.secundario }}>
          <b style={{ color: T.ouro }}>{rodada.jogos.length} partida(s) já gravada(s).</b>
          <span style={{ display: "block", marginTop: 4, color: T.fraco }}>
            Sortear e gravar de novo substitui estas partidas — a rodada recomeça do zero.
          </span>
          <button
            onClick={() => {
              if (confirm("Apagar todas as partidas desta rodada? Placares e cartões lançados serão perdidos.")) {
                atualizar({ times: [], jogos: [], sorteioRascunho: null });
                setTravas({});
                avisar("Partidas da rodada apagadas");
              }
            }}
            style={{ marginTop: 8, color: T.laranja, fontSize: 12, fontWeight: 700, textDecoration: "underline" }}>
            Apagar partidas desta rodada
          </button>
        </Painel>
      )}

      <div className="flex gap-2">
        <Campo rotulo="Partidas">
          <select value={alvo} onChange={(e) => setNPartidas(Number(e.target.value))} style={{ ...inputStyle, padding: "10px", fontSize: 13 }}>
            {Array.from({ length: Math.max(1, maxPartidas) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n} partida{n > 1 ? "s" : ""} · {n * cfg.jogadoresPorTime * 2} jogadores</option>
            ))}
          </select>
        </Campo>
        <Botao className="flex-1" style={{ alignSelf: "flex-end" }} onClick={() => executar()}>Sortear</Botao>
      </div>

      {sorteio && diag && (
        <Painel className="space-y-3 p-3">
          <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(0,0,0,.28)" }}>
            <div>
              <p style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: T.fraco }}>Equilíbrio</p>
              <p style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color: diag.indiceEquilibrio >= 90 ? T.verde : diag.indiceEquilibrio >= 75 ? T.ouro : T.laranja }}>{diag.indiceEquilibrio}%</p>
            </div>
            <div style={{ textAlign: "right", fontSize: 11, lineHeight: 1.45, color: T.secundario }}>
              <p>Δ máx. <b style={{ color: T.texto }}>{diag.amplitude}★</b> · desvio {diag.desvio.toFixed(2)}</p>
              <p>{sorteio.diagnostico.alternativas} divisão(ões) equivalente(s)</p>
              <p style={{ fontFamily: "ui-monospace, monospace", color: T.ouro }}>seed {sorteio.seed}</p>
            </div>
          </div>
          <p style={{ fontSize: 10.5, textAlign: "center", color: T.fraco }}>
            Medido nas partidas completas. Cada equipe fecha com 1 goleiro + {cfg.jogadoresPorTime - cfg.goleirosPorTime} de linha.
          </p>

          {sel && <p className="rounded px-2 py-2 text-center" style={{ background: T.ouroFraco, fontSize: 12, color: T.ouroClaro }}>{nomes[sel]} selecionado — toque em outro para trocar.</p>}

          {sorteio.partidas.map((p, pi) => {
            const vazias = contarVazias(p);
            return (
              <div key={p.numero}>
                <FaixaPartida n={p.numero} extra={vazias > 0} />
                {vazias > 0 && (
                  <p className="mb-1.5 rounded px-2 py-1.5" style={{ background: "rgba(255,165,61,.12)", border: `1px solid rgba(255,165,61,.4)`, fontSize: 10.5, lineHeight: 1.45, color: T.laranja }}>
                    Esta partida tem {vazias} vaga(s) em aberto. Complete com quem está presente —
                    quem já jogou entra só para preencher a vaga, sem pontuar nada (nem cartão).
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <CardTime p={p} pi={pi} lado="amarelo" />
                  <CardTime p={p} pi={pi} lado="azul" />
                </div>
                {vazias > 0 && (
                  <div className="mt-2 flex gap-2">
                    <Botao variante="secundario" className="flex-1" style={{ minHeight: 42, fontSize: 11.5 }} onClick={() => completarAutomaticamente(p.numero)}>
                      Completar automaticamente
                    </Botao>
                  </div>
                )}
              </div>
            );
          })}

          <p style={{ textAlign: "center", fontSize: 10.5, lineHeight: 1.6, color: T.fraco }}>
            Toque num jogador e depois em outro para trocar (funciona entre partidas)<br />
            ✕ esvazia a vaga · vaga de goleiro só troca com goleiro
          </p>

          {[...new Set([...(sorteio.diagnostico.avisos || []), ...(diag.violacoes || []).map((v) => v.texto)])].length > 0 && (
            <ul className="space-y-1 rounded-lg p-2" style={{ border: "1px solid rgba(255,165,61,.4)", background: "rgba(255,165,61,.12)", fontSize: 11.5, color: T.laranja }}>
              {[...new Set([...(sorteio.diagnostico.avisos || []), ...(diag.violacoes || []).map((v) => v.texto)])].map((a, i) => <li key={i}>⚠ {a}</li>)}
            </ul>
          )}

          {sorteio.sobressalentes.length > 0 && (
            <div className="rounded-lg p-2" style={{ background: "rgba(0,0,0,.25)", fontSize: 11.5, color: T.secundario }}>
              <b style={{ color: T.ouro }}>Fora do sorteio ({sorteio.sobressalentes.length}):</b>{" "}
              {sorteio.sobressalentes.map((j) => j.nome).join(", ")}
              <span style={{ display: "block", marginTop: 3, color: T.fraco }}>
                Estão presentes e aparecem na lista de qualquer vaga em aberto acima.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Botao onClick={gravar}>
              {vaziasTotal > 0 ? `Gravar · ${vaziasTotal} vaga(s) ficam em aberto` : "Gravar partidas"}
            </Botao>
            {vaziasTotal > 0 && (
              <p className="col-span-2 text-center" style={{ fontSize: 10.5, lineHeight: 1.4, color: T.fraco }}>
                As partidas completas já podem ser jogadas. As vagas em aberto se completam depois,
                na etapa Partidas, conforme mais gente for chegando.
              </p>
            )}
            <Botao variante="secundario" onClick={async () => {
              const txt = textoWhatsApp(sorteio.partidas, rodada, diag, sorteio.seed);
              try {
                if (navigator.share) { await navigator.share({ text: txt }); return; }
                await navigator.clipboard.writeText(txt); avisar("Copiado — cole no grupo");
              } catch {
                try { await navigator.clipboard.writeText(txt); avisar("Copiado"); } catch { avisar("Não foi possível copiar"); }
              }
            }}>Compartilhar</Botao>
            <Botao variante="secundario" onClick={() => executar()}>Sortear de novo</Botao>
            <Botao variante="secundario" onClick={() => executar(sorteio.seed)}>Repetir seed</Botao>
          </div>
          <button onClick={() => setSorteio(null)} style={{ width: "100%", padding: 6, fontSize: 12, color: T.fraco }}>descartar sorteio</button>
        </Painel>
      )}
    </div>
  );
}


/* --------------------- Etapa 3: partidas e súmulas -----------------------*/
function EtapaJogos({ base, rodada, atualizar, cfg, dados, avisar, nomes, porId }) {
  const niveis = dados.disciplina.porRodada[rodada.id] || {};

  /* Reequilíbrio automático da(s) partida(s) ainda intocadas (sem placar, sem
   * cartão, sem gol lançado) que tenham vaga em aberto: sempre que a chamada
   * muda — alguém chega atrasado, ou é tirado da lista —, essas partidas são
   * re-sorteadas do zero entre quem sobrou pra elas + quem chegou agora, SEM
   * mexer em nenhuma partida já em andamento. Isso evita o cenário de "time A
   * com dois 5★ porque o atrasado só coube ali": ninguém fica travado numa
   * escalação ruim só por ordem de chegada. */
  useEffect(() => {
    const gkPorTime = cfg.goleirosPorTime, linhaPorTime = cfg.jogadoresPorTime - gkPorTime;
    const P = poolsDoDia(base, rodada, porId, dados, cfg);
    const idsEmUso = new Set();
    for (const t of rodada.times || []) for (const jj of t.jogadores || []) idsEmUso.add(jj.jogadorId);
    const sobraIds = P.aptos.map((e) => e.jogador.id).filter((id) => !idsEmUso.has(id));
    const sobraSet = new Set(sobraIds);
    const entradaDe = (jid) => {
      const j = base.jogadores.find((x) => x.id === jid);
      if (!j) return null;
      const l = porId[jid];
      return { id: jid, nome: j.nome, ehGoleiro: j.posicao === "GOLEIRO", estrelas: j.convidado ? (j.estrelasIniciais || 1) : (l?.estrelas || 1) };
    };

    let mudou = false;
    const novosTimes = (rodada.times || []).map((t) => ({ ...t }));

    for (const jogo of rodada.jogos || []) {
      if (jogo.encerrado) continue;
      const intocada = Object.keys(jogo.eventos || {}).length === 0 && !jogo.placarManual &&
        !(jogo.golsContraA || jogo.golsContraB || jogo.golsNaoComputadosA || jogo.golsNaoComputadosB);
      if (!intocada) continue;
      const tA = novosTimes.find((t) => t.id === jogo.timeA), tB = novosTimes.find((t) => t.id === jogo.timeB);
      if (!tA || !tB) continue;
      if (!(tA.vagasAbertas || []).length && !(tB.vagasAbertas || []).length) continue;

      const idsAntes = new Set([...idsDoTime(tA), ...idsDoTime(tB)]);
      const poolIds = [...idsAntes, ...sobraIds];
      const pool = poolIds.map(entradaDe).filter(Boolean);
      const gkPool = pool.filter((e) => e.ehGoleiro).sort((a, b) => b.estrelas - a.estrelas).slice(0, gkPorTime * 2);
      const lnPool = pool.filter((e) => !e.ehGoleiro).sort((a, b) => b.estrelas - a.estrelas).slice(0, linhaPorTime * 2);

      const A = [], B = [];
      gkPool.forEach((j, i) => (i % 2 === 0 ? A : B).push({ ...j, slotGoleiro: true }));
      lnPool.forEach((j, i) => (i % 4 === 0 || i % 4 === 3 ? A : B).push({ ...j, slotGoleiro: false }));
      const times2 = [A, B];
      const todos2 = [...A, ...B];

      /* Balanço de quem ainda disputa pontos: quem chegou agora (sobraSet) não
       * pode ficar amontoado do mesmo lado só porque calhou de cair perto na
       * ordenação por estrela. Emparelha os recém-chegados dois a dois (do
       * mais forte pro mais fraco) e força cada par em lados OPOSTOS — 2
       * pessoas → 1 de cada lado; 4 → 2 de cada lado — usando a mesma restrição
       * "separados" que já existe para pares fixos, então o custo continua
       * sendo minimizado com essa separação como regra rígida. */
      const novosNaLinha = lnPool.filter((j) => sobraSet.has(j.id)).sort((a, b) => b.estrelas - a.estrelas);
      const separacoesNovos = [];
      for (let i = 0; i + 1 < novosNaLinha.length; i += 2)
        separacoesNovos.push({ a: novosNaLinha[i].id, b: novosNaLinha[i + 1].id, tipo: "separados" });

      buscaLocal(times2, {
        pesos: cfg.pesos, goleirosPorTime: gkPorTime, goleirosSuficientes: false,
        totalCinco: todos2.filter((j) => j.estrelas === 5).length, duplasRecentes: null,
        restricoes: [
          ...(base.restricoes || []).filter((r) => todos2.some((j) => j.id === r.a) && todos2.some((j) => j.id === r.b)),
          ...separacoesNovos,
        ],
        usarAproveitamento: cfg.usarAproveitamento, travados: new Set(),
        nome: (x) => nomes[x] || "?", nomeTime: (i) => (i === 0 ? "Amarelo" : "Azul"),
      });

      const idsDepois = new Set(todos2.map((j) => j.id));
      const igual = idsAntes.size === idsDepois.size && [...idsAntes].every((id) => idsDepois.has(id));
      if (igual) continue;

      const vagasDe = (jogadores) => {
        const gk = jogadores.filter((j) => j.slotGoleiro), ln = jogadores.filter((j) => !j.slotGoleiro);
        const jogadoresFinal = [
          ...gk.slice(0, gkPorTime).map((j) => ({ jogadorId: j.id, estrelaNoSorteio: j.estrelas, atuaComoGoleiro: true })),
          ...ln.slice(0, linhaPorTime).map((j) => ({ jogadorId: j.id, estrelaNoSorteio: j.estrelas, atuaComoGoleiro: false })),
        ];
        const vagasAbertas = [
          ...Array(Math.max(0, gkPorTime - gk.length)).fill("GOLEIRO"),
          ...Array(Math.max(0, linhaPorTime - ln.length)).fill("LINHA"),
        ];
        return { jogadores: jogadoresFinal, vagasAbertas };
      };
      Object.assign(tA, vagasDe(A)); Object.assign(tB, vagasDe(B));
      mudou = true;
    }

    if (mudou) { atualizar({ times: novosTimes }); avisar("A última partida em aberto foi reequilibrada com quem está presente"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodada.presencas]);

  if (!rodada.jogos.length)
    return <Painel className="p-6 text-center" style={{ borderStyle: "dashed", fontSize: 14, color: T.secundario }}>Nenhuma partida sorteada ainda. Volte para a etapa Sorteio.</Painel>;

  return (
    <div className="space-y-4">
      {Object.keys(niveis).length > 0 && (
        <Painel className="p-3" style={{ fontSize: 11.5, color: T.secundario }}>
          <b style={{ color: T.laranja }}>Atrasos sinalizados na súmula (§8º):</b>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(niveis).map(([jid, n]) => <span key={jid} className="flex items-center gap-1">{nomes[jid]} <SeloAtraso nivel={n} cfg={cfg} /></span>)}
          </div>
        </Painel>
      )}

      {[...rodada.jogos].sort((a, b) => a.numero - b.numero).map((jogo) => (
        <div key={jogo.id}>
          <FaixaPartida n={jogo.numero} />
          <Sumula {...{ jogo, rodada, base, cfg, dados, atualizar, avisar, niveis, porId }} />
        </div>
      ))}

      <Ajustes rodada={rodada} base={base} dados={dados} onMudar={atualizar} />

      {rodada.jogos.some((g) => g.encerrado) && (
        <Botao variante="secundario" className="w-full" onClick={() => { atualizar({ status: "fechada" }); avisar(`Rodada ${rodada.numero} fechada · estrelas recalculadas`); }}>
          Fechar rodada {rodada.numero}
        </Botao>
      )}

      <button
        onClick={() => {
          if (confirm(`Apagar as ${rodada.jogos.length} partida(s) desta rodada? Placares e cartões lançados serão perdidos, e você poderá sortear de novo do zero.`)) {
            atualizar({ times: [], jogos: [] });
            avisar("Partidas apagadas · sorteie novamente");
          }
        }}
        style={{ width: "100%", padding: 10, marginTop: 4, fontSize: 12, fontWeight: 700, color: T.fraco, border: `1px solid ${T.borda}`, borderRadius: 8 }}>
        Apagar partidas desta rodada
      </button>
    </div>
  );
}

/* --------------------------- Súmula da partida ---------------------------*/
function Sumula({ jogo, rodada, base, cfg, dados, atualizar, avisar, niveis, porId }) {
  const jog = Object.fromEntries(base.jogadores.map((j) => [j.id, j]));
  const tA = timePorId(rodada, jogo.timeA), tB = timePorId(rodada, jogo.timeB);
  const p = placarDe(jogo, rodada);
  const soCartoes = new Set([...(jogo.completaTime || []), ...(jogo.soCartoes || [])]);
  const mudar = (patch) => atualizar({ jogos: rodada.jogos.map((g) => (g.id === jogo.id ? { ...g, ...patch } : g)) });
  if (!tA || !tB) return null;

  /* Vaga em aberto (Art. 34º §14º/§17º): quem chega atrasado, ou quem sobrou
   * do sorteio, completa aqui — sem precisar apagar e refazer o sorteio.
   * Os candidatos são todos os presentes/atrasados aptos que ainda não estão
   * NESTA partida (podem já ter jogado outra, aí só preenchem sem pontuar). */
  const jaNestaPartida = new Set([...idsDoTime(tA), ...idsDoTime(tB)]);
  const candidatos = dados
    ? poolsDoDia(base, rodada, porId, dados, cfg).aptos.filter((e) => !jaNestaPartida.has(e.jogador.id))
    : [];
  const apareceuEmOutroJogo = (jid) => (rodada.jogos || []).some((g) => g.id !== jogo.id &&
    [g.timeA, g.timeB].some((tid) => idsDoTime(timePorId(rodada, tid)).includes(jid)));

  // Estrelas de cada equipe (força no sorteio) e um índice de equilíbrio, nos
  // mesmos moldes da etapa Sorteio — assim dá pra ver, aqui em Partidas, se a
  // divisão (inclusive depois de um reequilíbrio automático) ficou justa.
  // Quem só completou o time (§10º) não pontua e não entra nessa conta — ele
  // não está de fato disputando a partida, só preenchendo a vaga.
  const forcaDe = (t) => (t.jogadores || []).filter((j) => !soCartoes.has(j.jogadorId)).reduce((s, j) => s + (j.estrelaNoSorteio || 0), 0);
  const forcaA = forcaDe(tA), forcaB = forcaDe(tB);
  const temVagaAberta = (tA.vagasAbertas || []).length > 0 || (tB.vagasAbertas || []).length > 0;
  const mediaForca = (forcaA + forcaB) / 2;
  const diffForca = Math.abs(forcaA - forcaB);
  const indiceEquilibrio = mediaForca > 0 ? Math.max(0, Math.min(100, Math.round(100 - (diffForca / mediaForca) * 70))) : 100;

  const preencherVaga = (timeId, papel, jogadorId) => {
    if (!jogadorId) return;
    const repete = apareceuEmOutroJogo(jogadorId);
    const l = porId[jogadorId];
    const cand = candidatos.find((e) => e.jogador.id === jogadorId);
    const novoTimes = (rodada.times || []).map((t) => {
      if (t.id !== timeId) return t;
      const idxVaga = (t.vagasAbertas || []).indexOf(papel);
      const vagasAbertas = idxVaga === -1 ? (t.vagasAbertas || [])
        : [...t.vagasAbertas.slice(0, idxVaga), ...t.vagasAbertas.slice(idxVaga + 1)];
      return {
        ...t, vagasAbertas,
        jogadores: [...(t.jogadores || []), {
          jogadorId, estrelaNoSorteio: cand?.jogador?.convidado ? (cand.jogador.estrelasIniciais || 1) : (l?.estrelas || 1),
          atuaComoGoleiro: papel === "GOLEIRO",
        }],
      };
    });
    const novoJogos = repete
      ? (rodada.jogos || []).map((g) => (g.id === jogo.id ? { ...g, soCartoes: [...new Set([...(g.soCartoes || []), jogadorId])] } : g))
      : rodada.jogos;
    atualizar({ times: novoTimes, jogos: novoJogos });
    avisar(repete ? `${jog[jogadorId]?.nome} completou a equipe — já jogou, não pontua de novo` : `${jog[jogadorId]?.nome} entrou na vaga`);
  };

  const setEvento = (jid, campo, d) => {
    const at = { ...evVazio, ...(jogo.eventos[jid] || {}) };
    const novo = { ...at, [campo]: Math.max(0, at[campo] + d) };
    if (d > 0 && cfg.converterSegundoAmarelo && (campo === "ca" || campo === "cz")) {
      if (novo.ca >= 2) avisar(`${jog[jid]?.nome}: 2º amarelo vira vermelho (Art. 81º §Único)`);
      else if (novo.ca >= 1 && novo.cz >= 1) avisar(`${jog[jid]?.nome}: amarelo + azul vira vermelho (Art. 81º §Único)`);
    }
    mudar({ eventos: { ...jogo.eventos, [jid]: novo } });
  };
  const setPlacar = (lado, d) => {
    const atual = jogo.placarManual || { A: p.calcA, B: p.calcB };
    mudar({ placarManual: { ...atual, [lado]: Math.max(0, atual[lado] + d) } });
  };
  // Gol contra e gol não computado somam no placar automaticamente (via
  // placarDe). Mas se o placar já foi travado em "manual" — o que acontece
  // sempre que a partida é encerrada, mesmo sem ninguém ter mexido no placar
  // à mão — esses cliques precisam empurrar o placarManual junto, senão o
  // gol fica registrado na estatística mas some da tela/placar oficial.
  const ajustarGolQueSomaNoPlacar = (campo, ladoNoPlacar, d) => {
    const atualCampo = jogo[campo] || 0;
    const novoCampo = Math.max(0, atualCampo + d);
    const diff = novoCampo - atualCampo;
    const atualizacoes = { [campo]: novoCampo };
    if (jogo.placarManual && diff !== 0) {
      const pm = jogo.placarManual;
      atualizacoes.placarManual = { ...pm, [ladoNoPlacar]: Math.max(0, pm[ladoNoPlacar] + diff) };
    }
    mudar(atualizacoes);
  };

  const Coluna = ({ time, lado }) => (
    <div className="min-w-0">
      <p className="mb-2 w-full rounded text-center" style={{ padding: "7px 4px", fontSize: 10.5, fontWeight: 900, letterSpacing: ".1em", color: corDe(time.chave).hex, border: `1px solid ${T.borda}`, background: "rgba(0,0,0,.2)" }}>
        {time.cor}
      </p>
      <div className="space-y-1">
        {[...(time.jogadores || [])].sort((a, b) => Number(!!b.atuaComoGoleiro) - Number(!!a.atuaComoGoleiro)).map(({ jogadorId: jid, atuaComoGoleiro }) => {
          const bruto = { ...evVazio, ...(jogo.eventos[jid] || {}) };
          const ev = normalizarCartoes(bruto, cfg);
          const virouVermelho = ev.cv !== bruto.cv;
          // completou equipe: não pontua NADA, nem cartão (§10º)
          const soCartao = soCartoes.has(jid);
          // Já foi expulso nesta partida — vermelho direto, 2º amarelo, ou
          // amarelo + azul juntos (Art. 81º §Único). Dali pra frente não dá
          // pra somar mais nenhum cartão.
          const expulso = bruto.cv > 0 || bruto.ca >= 2 || (bruto.ca >= 1 && bruto.cz >= 1);
          return (
            <div key={jid} className="rounded-lg p-1.5" style={{
              background: atuaComoGoleiro ? "rgba(79,163,255,.09)" : "rgba(0,0,0,.26)",
              border: soCartao ? `1px dashed ${T.laranja}` : "1px solid transparent"
            }}>
              <div className="mb-1 flex items-start justify-between gap-1">
                <span className="flex min-w-0 items-center gap-1" style={{ fontSize: 12.5, color: soCartao ? T.fraco : T.texto, fontStyle: soCartao ? "italic" : "normal" }}>
                  {atuaComoGoleiro && <IconeGoleiro tam={12} />}<span className="truncate">{jog[jid]?.nome || "?"}</span>
                  {niveis?.[jid] && <SeloAtraso nivel={niveis[jid]} cfg={cfg} mini />}
                </span>
                <button onClick={() => mudar({
                  completaTime: (jogo.completaTime || []).filter((x) => x !== jid),
                  soCartoes: soCartao ? (jogo.soCartoes || []).filter((x) => x !== jid) : [...new Set([...(jogo.soCartoes || []), jid])],
                })} title="Art. 34º §10º — entrou só para completar equipe: não pontua nada, nem cartão"
                  style={{
                    flexShrink: 0, borderRadius: 3, padding: "1px 4px", fontSize: 9, fontWeight: 800,
                    background: soCartao ? "rgba(255,165,61,.22)" : "rgba(255,255,255,.07)",
                    color: soCartao ? T.laranja : T.fraco
                  }}>
                  §10
                </button>
              </div>
              {soCartao && <p style={{ fontSize: 9.5, color: T.laranja, marginBottom: 4 }}>completou equipe — não pontua nada, nem cartão</p>}
              {!soCartao && virouVermelho && bruto.ca >= 2 && <p style={{ fontSize: 9.5, color: T.vermelho, marginBottom: 4 }}>2º amarelo → vermelho (Art. 81º) · cartões bloqueados nesta partida</p>}
              {!soCartao && virouVermelho && bruto.ca < 2 && <p style={{ fontSize: 9.5, color: T.vermelho, marginBottom: 4 }}>Amarelo + azul → vermelho (Art. 81º) · cartões bloqueados nesta partida</p>}
              {!soCartao && !virouVermelho && bruto.cv > 0 && <p style={{ fontSize: 9.5, color: T.vermelho, marginBottom: 4 }}>Vermelho direto · cartões bloqueados nesta partida</p>}
              <div className="grid grid-cols-2 gap-1">
                {[["gols", "GOL"], ["assistencias", "ASS"]].map(([campo, rot]) => (
                  <div key={campo} className="flex items-center justify-between rounded" style={{ background: "rgba(255,255,255,.06)", padding: 2, opacity: soCartao ? 0.3 : 1 }}>
                    <button onClick={() => !soCartao && setEvento(jid, campo, -1)} style={{ padding: "4px 6px", color: T.fraco, fontSize: 15 }}>−</button>
                    <span style={{ fontSize: 9, color: T.fraco }}>{rot}</span>
                    <span style={{ width: 12, textAlign: "center", fontSize: 12.5, fontWeight: 800, color: T.texto }}>{bruto[campo]}</span>
                    <button onClick={() => !soCartao && setEvento(jid, campo, 1)} style={{ padding: "4px 6px", color: T.ouro, fontSize: 15 }}>+</button>
                  </div>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {[["ca", "CA", T.laranja], ["cv", "CV", T.vermelho], ["cz", "CA", T.gk]].map(([campo, rot, cor]) => {
                  // §10º: quem só completou o time não pontua nada, nem cartão.
                  const desativado = soCartao;
                  // Depois de expulso (vermelho direto ou 2º amarelo), não dá
                  // pra somar mais nenhum cartão nesta partida — só desfazer (−).
                  const travaSoma = !soCartao && expulso;
                  return (
                    <div key={campo} className="flex items-center justify-between rounded" style={{ background: `${cor}1F`, padding: 2, opacity: desativado ? 0.3 : 1 }}>
                      <button onClick={() => !desativado && setEvento(jid, campo, -1)} style={{ padding: "4px 6px", color: T.fraco, fontSize: 15 }}>−</button>
                      <span style={{ fontSize: 9, color: cor, fontWeight: 800 }}>{rot}</span>
                      <span style={{ width: 12, textAlign: "center", fontSize: 12.5, fontWeight: 800, color: T.texto }}>{bruto[campo]}</span>
                      <button onClick={() => !desativado && !travaSoma && setEvento(jid, campo, 1)} title={travaSoma ? "Já foi expulso nesta partida — não dá pra somar mais cartão" : undefined}
                        style={{ padding: "4px 6px", color: cor, fontSize: 15, opacity: travaSoma ? 0.35 : 1 }}>+</button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {(time.vagasAbertas || []).map((papel, vi) => {
          const jaEscolhidos = new Set([...idsDoTime(tA), ...idsDoTime(tB)]);
          const opcoes = candidatos.filter((e) => !jaEscolhidos.has(e.jogador.id));
          return (
            <div key={`va${vi}`} className="rounded" style={{ background: "rgba(255,165,61,.1)", border: `1px dashed ${T.laranja}`, padding: 5 }}>
              <div className="mb-1 flex items-center gap-1">
                {papel === "GOLEIRO" ? <IconeGoleiro tam={12} /> : <span style={{ fontSize: 10, color: T.laranja }}>▢</span>}
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".06em", color: T.laranja }}>VAGA DE {papel} · quem chegou</span>
              </div>
              <select value="" onChange={(e) => preencherVaga(time.id, papel, e.target.value)}
                style={{ ...inputStyle, padding: "7px 4px", fontSize: 11.5 }}>
                <option value="">— escolher quem completa —</option>
                {opcoes.map(({ jogador: o, linha: l }) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}{o.posicao === "GOLEIRO" ? " (GK)" : ""} · {l?.estrelas || 1}★
                    {apareceuEmOutroJogo(o.id) ? " · já jogou, não pontua" : ""}
                  </option>
                ))}
              </select>
              {opcoes.length === 0 && <p style={{ fontSize: 9.5, color: T.fraco, marginTop: 3 }}>Ninguém presente disponível ainda — marque a chegada na etapa Presença.</p>}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-between rounded px-2" style={{ background: "rgba(255,165,61,.08)" }}
        title="Gol de quem não pontua (§10º) ou que ninguém viu quem fez — soma no placar da própria equipe sem ir pra estatística de ninguém">
        <span style={{ fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", color: T.laranja }}>Gol não computado</span>
        <div className="flex items-center">
          <button onClick={() => ajustarGolQueSomaNoPlacar(`golsNaoComputados${lado}`, lado, -1)} style={{ padding: "6px 8px", color: T.fraco }}>−</button>
          <span style={{ width: 12, textAlign: "center", fontSize: 12.5, fontWeight: 800 }}>{jogo[`golsNaoComputados${lado}`] || 0}</span>
          <button onClick={() => ajustarGolQueSomaNoPlacar(`golsNaoComputados${lado}`, lado, 1)} style={{ padding: "6px 8px", color: T.laranja }}>+</button>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between rounded px-2" style={{ background: "rgba(255,255,255,.06)" }}>
        <span style={{ fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", color: T.fraco }}>Gol contra</span>
        <div className="flex items-center">
          <button onClick={() => ajustarGolQueSomaNoPlacar(`golsContra${lado}`, lado === "A" ? "B" : "A", -1)} style={{ padding: "6px 8px", color: T.fraco }}>−</button>
          <span style={{ width: 12, textAlign: "center", fontSize: 12.5, fontWeight: 800 }}>{jogo[`golsContra${lado}`] || 0}</span>
          <button onClick={() => ajustarGolQueSomaNoPlacar(`golsContra${lado}`, lado === "A" ? "B" : "A", 1)} style={{ padding: "6px 8px", color: T.ouro }}>+</button>
        </div>
      </div>
    </div>
  );

  return (
    <Painel style={{ borderColor: jogo.encerrado ? "rgba(61,214,140,.45)" : T.borda }}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3">
        {["A", "B"].map((lado, i) => (
          <React.Fragment key={lado}>
            {i === 1 && <span style={{ fontSize: 24, fontWeight: 200, color: "rgba(255,255,255,.2)" }}>×</span>}
            <div className="text-center">
              <p style={{ marginBottom: 4, fontSize: 10.5, fontWeight: 900, letterSpacing: ".12em", color: corDe((lado === "A" ? tA : tB).chave).hex }}>{(lado === "A" ? tA : tB).cor}</p>
              <p style={{ marginBottom: 4, fontSize: 12, fontWeight: 800, color: T.ouro }}>{lado === "A" ? forcaA : forcaB}★</p>
              <div className="flex items-center justify-center gap-1.5">
                <button onClick={() => setPlacar(lado, -1)} style={{ width: 40, height: 40, borderRadius: 9, background: "rgba(255,255,255,.08)", color: T.secundario, fontSize: 20 }}>−</button>
                <span style={{ width: 42, fontSize: 40, fontWeight: 900, lineHeight: 1 }}>{p[lado]}</span>
                <button onClick={() => setPlacar(lado, 1)} style={{ width: 40, height: 40, borderRadius: 9, background: "rgba(255,255,255,.08)", color: T.ouro, fontSize: 20 }}>+</button>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-lg px-3 py-1.5" style={{ background: "rgba(0,0,0,.22)" }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: T.fraco }}>Equilíbrio</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: indiceEquilibrio >= 90 ? T.verde : indiceEquilibrio >= 75 ? T.ouro : T.laranja }}>{indiceEquilibrio}%</span>
        <span style={{ fontSize: 10.5, color: T.secundario }}>· Δ {diffForca}★</span>
        {temVagaAberta && <span style={{ fontSize: 10, color: T.laranja }}>· parcial (tem vaga aberta)</span>}
      </div>

      <p className="px-3 pb-2 text-center" style={{ fontSize: 10.5, lineHeight: 1.5, color: p.divergente ? T.laranja : T.fraco }}>
        {p.manual ? <>Placar lançado à mão{p.divergente && ` · a soma dos gols dá ${p.calcA}×${p.calcB}`} · <button onClick={() => mudar({ placarManual: null })} style={{ textDecoration: "underline" }}>voltar ao automático</button></>
          : "Placar somado dos gols individuais + gols contra + gols não computados. Toque em +/− para sobrescrever."}
      </p>

      <div className="grid grid-cols-2 gap-2 px-2 py-2" style={{ borderTop: `1px solid ${T.borda}` }}>
        <Coluna time={tA} lado="A" /><Coluna time={tB} lado="B" />
      </div>

      <div className="p-3" style={{ borderTop: `1px solid ${T.borda}` }}>
        <Botao variante={jogo.encerrado ? "secundario" : "primario"} className="w-full"
          onClick={() => {
            mudar({ encerrado: !jogo.encerrado, placarManual: jogo.placarManual || { A: p.A, B: p.B } });
            avisar(jogo.encerrado ? `Partida ${jogo.numero} reaberta` : `Partida ${jogo.numero} encerrada · ${p.A}×${p.B}`);
          }}>{jogo.encerrado ? "Reabrir partida" : "Encerrar partida"}</Botao>
        {!jogo.encerrado && <p className="mt-1.5 text-center" style={{ fontSize: 10.5, color: T.fraco }}>Só entra na classificação depois de encerrada.</p>}
      </div>
    </Painel>
  );
}

/* --------------------------- Ajustes P+ / P− -----------------------------*/
function Ajustes({ rodada, base, dados, onMudar }) {
  const [jid, setJid] = useState(""); const [valor, setValor] = useState(1); const [motivo, setMotivo] = useState("");
  const nomes = Object.fromEntries(base.jogadores.map((j) => [j.id, j.nome]));
  // Lista suspensa vem da própria tabela de classificação (já ordenada por
  // posição), não da lista crua de jogadores — assim ninguém que está
  // classificado fica de fora, e a ordem já ajuda a achar o jogador.
  const opcoesJogadores = ((dados?.classificacao || []).length
    ? dados.classificacao.map((l) => ({ id: l.id, nome: l.nome }))
    : base.jogadores.map((j) => ({ id: j.id, nome: j.nome })))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <section>
      <Secao titulo="Ajustes P+ / P−" detalhe="lançamentos manuais" />
      <Painel className="space-y-2 p-3">
        <p style={{ fontSize: 11, color: T.fraco }}>Atrasos e cartões já descontam sozinhos. Use aqui só o que o regulamento não automatiza.</p>
        {(rodada.ajustes || []).map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded px-2 py-1.5" style={{ background: "rgba(0,0,0,.25)", fontSize: 13 }}>
            <span className="truncate" style={{ color: T.secundario }}>{nomes[a.jogadorId]} <span style={{ color: T.fraco }}>· {a.motivo || "sem motivo"}</span></span>
            <span className="flex items-center gap-2">
              <b style={{ color: a.valor >= 0 ? T.verde : T.vermelho }}>{a.valor >= 0 ? "+" : ""}{a.valor}</b>
              <button onClick={() => onMudar({ ajustes: rodada.ajustes.filter((x) => x.id !== a.id) })} style={{ color: T.fraco }}>✕</button>
            </span>
          </div>
        ))}
        <div className="flex gap-2">
          <select value={jid} onChange={(e) => setJid(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "10px 8px", fontSize: 13 }}>
            <option value="">Jogador…</option>{opcoesJogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
          </select>
          <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} style={{ ...inputStyle, width: 64, padding: "10px 4px", textAlign: "center", fontSize: 13 }} />
        </div>
        <div className="flex gap-2">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" style={{ ...inputStyle, flex: 1, padding: "10px 8px", fontSize: 13 }} />
          <Botao style={{ padding: "0 14px" }} onClick={() => {
            if (!jid || !Number(valor)) return;
            onMudar({ ajustes: [...(rodada.ajustes || []), { id: id(), jogadorId: jid, valor: Number(valor), motivo }] });
            setJid(""); setValor(1); setMotivo("");
          }}>Lançar</Botao>
        </div>
      </Painel>
    </section>
  );
}

/* ======================= TELA: CLASSIFICAÇÃO =============================*/
function TelaClassificacao({ base, dados, cfg, avisar }) {
  const [vista, setVista] = useState("classificacao");
  const [detalhe, setDetalhe] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const cols = [["P", "pontos"], ["%", "aproveitamento"], ["J", "J"], ["V", "V"], ["E", "E"], ["D", "D"],
  ["GP", "GP"], ["GC", "GC"], ["SG", "SG"], ["G", "gols"], ["A", "assistencias"], ["CA", "CA"], ["CV", "CV"], ["P+", "Pmais"], ["P−", "Pmenos"]];

  const visiveis = dados.classificacao
    .filter((l) => l.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    .filter((l) => filtro === "todos" ? true
      : filtro === "linha" ? l.jogador.posicao !== "GOLEIRO"
        : filtro === "goleiros" ? l.jogador.posicao === "GOLEIRO"
          : filtro === "supercopa" ? l.supercopa
            : l.atrasosNoMes > 0 || l.jogador.pendenciaFinanceira || l.jogador.pontuacaoPendente || l.cartoes > 0);

  const cor = (k, l) => k === "pontos" ? T.ouro : k === "SG" ? (l.SG > 0 ? T.verde : l.SG < 0 ? T.vermelho : T.fraco)
    : k === "Pmais" ? T.verde : k === "Pmenos" ? T.vermelho : k === "aproveitamento" ? T.texto : T.secundario;

  return (
    <div className="space-y-3">
      {/* Alternador Classificação | Resultados */}
      <div className="flex rounded-xl p-1" style={{ background: "rgba(255,255,255,.06)", border: `1px solid ${T.borda}` }}>
        {[["classificacao", "Classificação"], ["resultados", "Resultados"]].map(([v, r]) => (
          <button key={v} onClick={() => setVista(v)} className="flex-1 rounded-lg"
            style={{
              padding: "10px 0", fontSize: 12.5, fontWeight: 800, letterSpacing: ".04em",
              background: vista === v ? `linear-gradient(180deg,${T.ouroClaro},${T.ouro})` : "transparent",
              color: vista === v ? "#0a1b3d" : T.secundario
            }}>{r}</button>
        ))}
      </div>

      {vista === "resultados" ? <Resultados base={base} cfg={cfg} /> : (<>
        <Secao titulo="Classificação geral" detalhe={`Supercopa: 1º ao ${cfg.zonaSupercopa}º`} /></>)}

      {vista === "classificacao" && (<>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar jogador…" style={inputStyle} />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[["todos", "Todos"], ["linha", "Linha"], ["goleiros", "Goleiros"], ["supercopa", "Supercopa"], ["alerta", "Alertas"]].map(([f, r]) => (
            <button key={f} onClick={() => setFiltro(f)} className="shrink-0 rounded-full"
              style={{ padding: "9px 15px", fontSize: 12, fontWeight: 800, background: filtro === f ? `linear-gradient(180deg,${T.ouroClaro},${T.ouro})` : "rgba(255,255,255,.07)", color: filtro === f ? "#0a1b3d" : T.secundario }}>{r}</button>
          ))}
        </div></>)}

      {vista === "classificacao" && (<>
        <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${T.borda}` }}>
          <table style={{ width: "100%", textAlign: "right", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,.3)", borderBottom: `2px solid ${T.ouro}` }}>
                <th style={{ padding: "8px 5px", textAlign: "center", fontSize: 9.5, color: T.fraco }}>#</th>
                <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 9.5, color: T.fraco }}>JOGADOR</th>
                <th style={{ padding: "8px 5px", textAlign: "center", fontSize: 9.5, color: T.fraco }}>CLASSE</th>
                {cols.map(([r]) => <th key={r} style={{ padding: "8px 5px", fontSize: 9.5, color: T.fraco }}>{r}</th>)}
                <th style={{ padding: "8px 5px", textAlign: "center", fontSize: 9.5, color: T.fraco }}>ÚLT. 5</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l, i) => (
                <tr key={l.id} onClick={() => setDetalhe(detalhe === l.id ? null : l.id)}
                  style={{ background: l.supercopa ? T.ouroFraco : i % 2 ? T.linhaPar : "transparent", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer" }}>
                  <td style={{ padding: "8px 5px", textAlign: "center", fontWeight: 900, color: l.supercopa ? T.ouro : T.fraco, borderLeft: l.supercopa ? `4px solid ${T.ouro}` : "4px solid transparent" }}>{l.posicao}</td>
                  <td style={{ padding: "8px 6px", textAlign: "left" }}>
                    <div className="flex items-center gap-1.5" style={{ whiteSpace: "nowrap" }}>
                      {l.jogador.posicao === "GOLEIRO" && <IconeGoleiro />}
                      <span style={{ color: T.texto, fontWeight: 600, fontSize: 12.5 }}>{l.nome}</span>
                      {l.nivelAtraso && <SeloAtraso nivel={l.atrasosNoMes} cfg={cfg} mini />}
                      <Marcadores jogador={l.jogador} />
                    </div>
                    {detalhe === l.id && (
                      <p style={{ marginTop: 3, fontSize: 10.5, lineHeight: 1.5, fontWeight: 400, color: T.ouroClaro, whiteSpace: "normal" }}>
                        {l.criterioAplicado ? `Desempate: ${ROTULO_CRITERIO[l.criterioAplicado]}` : "Líder da tabela"}
                        {l.rankCategoria && ` · ${l.rankCategoria}º entre ${l.totalCategoria} ${l.ehGoleiro ? "goleiros" : "de linha"} → ${l.estrelas}★`}
                        <span style={{ display: "block", color: T.secundario }}>
                          Ciclo de amarelos: {l.cartoesNoCiclo}/{cfg.cartoesPorPonto} · atrasos no mês: {l.atrasosNoMes}
                          {l.nivelAtraso && ` — ${l.nivelAtraso.rotulo}`}
                        </span>
                        {l.Pmenos > 0 && <span style={{ display: "block", color: T.vermelho }}>
                          P−: {l.histPmenos} histórico + {l.pontosAtraso} atraso + {l.penalAmarelo} amarelos + {l.penalVermelho} vermelho + {l.penalidadeManual} manual
                        </span>}
                        {l.jogador.posicaoInferida && <span style={{ display: "block", color: T.gk }}>Goleiro inferido da tabela oficial — confirme no Elenco.</span>}
                      </p>
                    )}
                  </td>
                  <td style={{ padding: "8px 5px", textAlign: "center" }}><Estrelas n={l.estrelas} tam={10.5} goleiro={l.ehGoleiro} /></td>
                  {cols.map(([r, k]) => (
                    <td key={r} style={{ padding: "8px 5px", color: cor(k, l), fontWeight: k === "pontos" ? 900 : 400, fontSize: k === "pontos" ? 13 : 11 }}>
                      {k === "aproveitamento" ? `${l[k]}%` : k === "SG" ? `${l.SG > 0 ? "+" : ""}${l.SG}` : (k === "Pmais" || k === "Pmenos") ? (l[k] || "") : l[k]}
                    </td>
                  ))}
                  <td style={{ padding: "8px 5px" }}>
                    <div className="flex justify-center gap-0.5">
                      {l.ultimos5.map((r, k) => (
                        <span key={k} style={{
                          display: "inline-block", width: 16, height: 16, borderRadius: 3, fontSize: 9, fontWeight: 800, lineHeight: "16px", textAlign: "center",
                          background: r === "V" ? T.verde : r === "E" ? "#5A76A8" : r === "D" ? T.vermelho : "rgba(255,255,255,.07)",
                          color: r === "V" || r === "D" ? "#06122b" : r === "E" ? "#fff" : "rgba(255,255,255,.25)"
                        }}>{r}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visiveis.length === 0 && <Painel className="p-6 text-center" style={{ borderStyle: "dashed", color: T.secundario }}>Nenhum jogador com esse filtro.</Painel>}

        {dados.convidados.length > 0 && (
          <Painel className="p-3" style={{ borderColor: "rgba(192,140,255,.4)", fontSize: 11.5, color: T.secundario }}>
            <b style={{ color: T.roxo }}>Convidados (fora da classificação):</b> {dados.convidados.map((c) => `${c.nome} — ${c.J}J, ${c.gols}G`).join(" · ")}
          </Painel>
        )}

        <Painel className="p-3" style={{ fontSize: 11.5, lineHeight: 1.65, color: T.secundario }}>
          <b style={{ color: T.ouro }}>Pontuação</b> · P = J + (3 × V) + E + P⁺ − P⁻ · % = P ÷ ({cfg.baseAproveitamento === "previstas" ? cfg.rodadasPrevistas : dados.rodadasRealizadas} × {cfg.tetoPorRodada}) = ÷ {dados.teto}<br />
          <b style={{ color: T.ouro }}>Cartões</b> · {cfg.cartoesPorPonto} amarelos/azuis = −{cfg.pontosPorCicloAmarelo} ponto (contagem reinicia, Art. 82º §2º) · cada vermelho = −{cfg.pontosPorVermelho}<br />
          <b style={{ color: T.ouro }}>Atrasos</b> · 1º alerta · 2º amarelo · 3º perde a presença · 4º suspensão. Zera na virada do mês, salvo emenda (§9º)<br />
          <b style={{ color: T.ouro }}>Classe</b> · 1º-3º = 5★ · 4º-6º = 4★ · 7º-9º = 3★ · 10º-14º = 2★ · 15º+ = 1★<br />
          <span style={{ color: T.fraco }}>Escala única: a classe sai da posição geral na tabela, goleiro (<span style={{ color: T.gk }}>★ azul</span>) e linha (<span style={{ color: T.ouro }}>★ ouro</span>) na mesma fila — a cor é só identificação visual. Toque na linha para ver o rank dentro da categoria.</span><br />
          <span style={{ color: T.ouro }}>▌</span> Zona Supercopa · <IconeGoleiro tam={13} /> goleiro · <span style={{ color: T.vermelho }}>$</span> pendência · (*) a confirmar
        </Painel>

        <div className="grid grid-cols-2 gap-2">
          <Botao variante="secundario" onClick={() => { baixarArquivo("jpffs-classificacao.csv", csvClassificacao(dados.classificacao)); avisar("CSV exportado"); }}>Exportar CSV</Botao>
          <Botao onClick={() => { imagemTabela(dados.classificacao, cfg, { rodadas: dados.rodadasRealizadas, teto: dados.teto }); avisar("Imagem PNG gerada"); }}>Imagem PNG</Botao>
        </div>
      </>)}
    </div>
  );
}

/* Aba de resultados dos jogos (só rodadas feitas no app — 21ª em diante). */
function Resultados({ base, cfg }) {
  const nomes = Object.fromEntries(base.jogadores.map((j) => [j.id, j.nome]));
  const [aberta, setAberta] = useState(null);
  const rodadas = [...(base.rodadas || [])]
    .filter((r) => (r.jogos || []).some((g) => g.encerrado))
    .sort((a, b) => b.numero - a.numero); // mais recente primeiro

  if (rodadas.length === 0)
    return (
      <Painel className="p-6 text-center" style={{ borderStyle: "dashed", color: T.secundario, fontSize: 13, lineHeight: 1.6 }}>
        Ainda não há resultados lançados no app.<br />
        <span style={{ color: T.fraco, fontSize: 12 }}>As rodadas aparecem aqui assim que forem encerradas.</span>
      </Painel>
    );

  return (
    <div className="space-y-2">
      {rodadas.map((rodada) => {
        const jogos = [...(rodada.jogos || [])].filter((g) => g.encerrado).sort((a, b) => a.numero - b.numero);
        const estaAberta = aberta === rodada.id;
        return (
          <div key={rodada.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.borda}` }}>
            {/* cabeçalho clicável */}
            <button onClick={() => setAberta(estaAberta ? null : rodada.id)}
              className="flex w-full items-center justify-between"
              style={{ padding: "13px 14px", background: estaAberta ? "rgba(240,192,64,.08)" : "rgba(255,255,255,.03)" }}>
              <span className="flex items-baseline" style={{ gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: T.ouro }}>{rodada.numero}ª rodada</span>
                <span style={{ fontSize: 11, color: T.fraco }}>{jogos.length} jogo(s)</span>
              </span>
              <span className="flex items-center" style={{ gap: 10 }}>
                {rodada.data && <span style={{ fontSize: 11, color: T.fraco }}>{new Date(rodada.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                <span style={{ fontSize: 12, color: T.secundario, transform: estaAberta ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
              </span>
            </button>

            {estaAberta && (
              <div className="space-y-2" style={{ padding: 10, background: "rgba(0,0,0,.15)" }}>
                <div className="flex flex-wrap items-center" style={{ gap: "6px 12px", fontSize: 10, color: T.fraco, paddingBottom: 2 }}>
                  <span>⚽ gol · 👟 assistência · 🟨 amarelo · 🟦 azul · 🟥 vermelho · 🔴 gol contra · ❔ gol não computado</span>
                  <span style={{ color: T.laranja, fontStyle: "italic" }}>● nome em laranja itálico = completou a equipe (§10º), não pontuou</span>
                </div>
                {jogos.map((jogo) => {
                  const p = placarDe(jogo, rodada);
                  const tA = (rodada.times || []).find((x) => x.id === jogo.timeA);
                  const tB = (rodada.times || []).find((x) => x.id === jogo.timeB);
                  const soCartoesJogo = new Set([...(jogo.completaTime || []), ...(jogo.soCartoes || [])]);
                  const gA = tA?.jogadores || [];
                  const gB = tB?.jogadores || [];
                  const ev = (jid) => eventoDe(jogo, jid);
                  // Deixa explícito qual dos 3 cenários aconteceu: amarelo
                  // isolado, vermelho direto, ou 2º amarelo convertido em
                  // vermelho (Art. 81º §Único) — mais o azul, que nunca
                  // converte, só soma peso de amarelo nos pontos (Art. 82º).
                  const linhaEventos = (grupo) => grupo.map((j) => {
                    const e = ev(j.jogadorId); const marcas = [];
                    if (e.gols > 0) marcas.push(`⚽${e.gols > 1 ? e.gols : ""}`);
                    if (e.assistencias > 0) marcas.push(`👟${e.assistencias > 1 ? e.assistencias : ""}`);
                    // Art. 81º §Único: 2º amarelo OU amarelo+azul viram vermelho automático.
                    const doisAmarelos = cfg.converterSegundoAmarelo && e.ca >= 2;
                    const amareloAzul = cfg.converterSegundoAmarelo && !doisAmarelos && e.ca >= 1 && e.cz >= 1;
                    if (doisAmarelos) marcas.push("🟨🟨→🟥 (2º amarelo)");
                    else if (amareloAzul) marcas.push("🟨🟦→🟥 (amarelo+azul)");
                    else if (e.ca > 0) marcas.push(`🟨${e.ca > 1 ? `×${e.ca}` : ""}`);
                    if (e.cv > 0) marcas.push(`🟥${(doisAmarelos || amareloAzul) ? " extra" : " direto"}${e.cv > 1 ? ` ×${e.cv}` : ""}`);
                    if (e.cz > 0 && !amareloAzul) marcas.push(`🟦${e.cz > 1 ? ` ×${e.cz}` : ""}`);
                    // Quem só completou o time (§10º) não pontuou nada — mas
                    // continua aparecendo aqui, só que destacado em outra cor,
                    // pra ficar claro quem realmente disputou a partida.
                    const completou = soCartoesJogo.has(j.jogadorId);
                    return { nome: nomes[j.jogadorId] || "?", marcas, completou };
                  });
                  const venceuA = p.A > p.B, venceuB = p.B > p.A;
                  return (
                    <Painel key={jogo.id} className="p-3">
                      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".12em", color: T.fraco, textAlign: "center", marginBottom: 6 }}>JOGO {jogo.numero}</div>
                      <div className="flex items-center justify-between" style={{ gap: 8 }}>
                        <span className="flex-1 text-right" style={{ fontSize: 13.5, fontWeight: venceuA ? 900 : 600, color: venceuA ? T.ouro : T.texto }}>Amarelo</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: T.texto, minWidth: 58, textAlign: "center", letterSpacing: ".05em" }}>{p.A} <span style={{ color: T.fraco }}>×</span> {p.B}</span>
                        <span className="flex-1" style={{ fontSize: 13.5, fontWeight: venceuB ? 900 : 600, color: venceuB ? "#7FB0FF" : T.texto }}>Azul</span>
                      </div>
                      <div className="flex justify-between" style={{ gap: 10, marginTop: 8, fontSize: 11, lineHeight: 1.7 }}>
                        <div className="flex-1 text-right" style={{ color: T.secundario }}>
                          {linhaEventos(gA).map((r, i) => (
                            <div key={i} style={{ color: r.completou ? T.laranja : T.secundario, fontStyle: r.completou ? "italic" : "normal" }}>
                              {r.nome} {r.marcas.length > 0 && <span>{r.marcas.join(" ")}</span>}
                            </div>
                          ))}
                        </div>
                        <div style={{ width: 1, background: T.borda }} />
                        <div className="flex-1" style={{ color: T.secundario }}>
                          {linhaEventos(gB).map((r, i) => (
                            <div key={i} style={{ color: r.completou ? T.laranja : T.secundario, fontStyle: r.completou ? "italic" : "normal" }}>
                              {r.marcas.length > 0 && <span>{r.marcas.join(" ")}</span>} {r.nome}
                            </div>
                          ))}
                        </div>
                      </div>
                      {((jogo.golsContraA || 0) + (jogo.golsContraB || 0) + (jogo.golsNaoComputadosA || 0) + (jogo.golsNaoComputadosB || 0)) > 0 && (
                        <div className="flex justify-between" style={{ gap: 10, marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${T.borda}`, fontSize: 10, color: T.laranja }}>
                          <div className="flex-1 text-right">
                            {jogo.golsContraA > 0 && <div>🔴 gol contra ×{jogo.golsContraA}</div>}
                            {jogo.golsNaoComputadosA > 0 && <div>❔ gol não computado ×{jogo.golsNaoComputadosA}</div>}
                          </div>
                          <div style={{ width: 1 }} />
                          <div className="flex-1">
                            {jogo.golsContraB > 0 && <div>gol contra ×{jogo.golsContraB} 🔴</div>}
                            {jogo.golsNaoComputadosB > 0 && <div>gol não computado ×{jogo.golsNaoComputadosB} ❔</div>}
                          </div>
                        </div>
                      )}
                    </Painel>
                  );
                })}
                {(rodada.ajustes || []).length > 0 && (
                  <Painel className="p-3" style={{ fontSize: 11.5, color: T.secundario }}>
                    <b style={{ color: T.ouro }}>Ajustes P+ / P− da rodada:</b>
                    <div className="mt-1.5 space-y-1">
                      {rodada.ajustes.map((aj) => (
                        <div key={aj.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">{nomes[aj.jogadorId] || aj.jogadorId} <span style={{ color: T.fraco }}>· {aj.motivo || "sem motivo"}</span></span>
                          <b style={{ flexShrink: 0, color: aj.valor >= 0 ? T.verde : T.vermelho }}>{aj.valor >= 0 ? "+" : ""}{aj.valor}</b>
                        </div>
                      ))}
                    </div>
                  </Painel>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* =========================== TELA: ELENCO ================================*/
function TelaElenco({ base, setBase, dados, cfg, avisar }) {
  const [nome, setNome] = useState(""); const [posicao, setPosicao] = useState("LINHA");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState("alfabetica");
  const [editando, setEditando] = useState(null);
  const inputRef = useRef(null);
  const porId = Object.fromEntries(dados.todos.map((l) => [l.id, l]));
  const atualizar = (jid, patch) => setBase({ ...base, jogadores: base.jogadores.map((j) => (j.id === jid ? { ...j, ...patch } : j)) });
  const inferidos = base.jogadores.filter((j) => j.posicaoInferida);

  function importar(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const txt = String(fr.result);
        let novos = [];
        if (f.name.endsWith(".json")) {
          const d = JSON.parse(txt);
          novos = (Array.isArray(d) ? d : d.jogadores || []).map((j) => ({
            id: id(), nome: j.nome, posicao: /goleiro/i.test(j.posicao || "") ? "GOLEIRO" : "LINHA",
            ativo: j.ativo !== false, convidado: !!j.convidado, estrelasIniciais: 1
          }));
        } else {
          const linhas = txt.split(/\r?\n/).filter(Boolean);
          const sep = linhas[0].includes(";") ? ";" : ",";
          novos = linhas.slice(/nome/i.test(linhas[0]) ? 1 : 0).map((l) => {
            const [n, pos] = l.split(sep);
            return { id: id(), nome: (n || "").trim(), posicao: /goleiro|gk/i.test(pos || "") ? "GOLEIRO" : "LINHA", ativo: true, convidado: false, estrelasIniciais: 1 };
          }).filter((j) => j.nome);
        }
        if (!novos.length) throw new Error();
        setBase({ ...base, jogadores: [...base.jogadores, ...novos] });
        avisar(`${novos.length} jogadores importados`);
      } catch { avisar("Arquivo inválido. CSV: nome;posicao"); }
    };
    fr.readAsText(f); e.target.value = "";
  }

  const ordenacoes = {
    alfabetica: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
    classificacao: (a, b) => (porId[a.id]?.posicao || 999) - (porId[b.id]?.posicao || 999),
    posicao: (a, b) => (b.posicao === "GOLEIRO") - (a.posicao === "GOLEIRO") || a.nome.localeCompare(b.nome, "pt-BR"),
  };
  const visiveis = [...base.jogadores]
    .filter((j) => j.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    .sort((a, b) => Number(!!a.convidado) - Number(!!b.convidado) || ordenacoes[ordem](a, b));

  return (
    <div className="space-y-4">
      {inferidos.length > 0 && (
        <Painel className="p-3" style={{ borderColor: T.gk, background: T.gkFraco, fontSize: 12, color: T.secundario }}>
          <b style={{ color: T.gk }}>Confirme os goleiros.</b> A marcação de {inferidos.length} jogadores ({inferidos.map((j) => j.nome).join(", ")}) foi inferida do ícone da tabela oficial.
          <Botao variante="secundario" className="mt-2 w-full" style={{ minHeight: 40 }}
            onClick={() => { setBase({ ...base, jogadores: base.jogadores.map((j) => ({ ...j, posicaoInferida: false })) }); avisar("Posições confirmadas"); }}>Confirmar todas</Botao>
        </Painel>
      )}

      <section>
        <Secao titulo="Novo jogador" detalhe="§11º — entra com 1★" />
        <Painel className="space-y-2 p-3">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" style={inputStyle} />
          <Segmento titulo="Posição" valor={posicao} onChange={setPosicao}
            opcoes={[{ valor: "LINHA", rotulo: "Linha" }, { valor: "GOLEIRO", rotulo: "Goleiro", cor: T.gk }]} />
          <div className="flex gap-2">
            <Botao className="flex-1" onClick={() => {
              if (!nome.trim()) return;
              setBase({ ...base, jogadores: [...base.jogadores, { id: id(), nome: nome.trim(), posicao, ativo: true, convidado: false, estrelasIniciais: 1, pendenciaFinanceira: false, pontuacaoPendente: false }] });
              avisar(`${nome.trim()} cadastrado com 1★`); setNome("");
            }}>Cadastrar</Botao>
            <Botao variante="secundario" onClick={() => inputRef.current?.click()}>Importar</Botao>
            <input ref={inputRef} type="file" accept=".json,.csv" className="hidden" onChange={importar} />
          </div>
          <p style={{ fontSize: 11, color: T.fraco }}>Art. 34º §11º: todo jogador começa com 1 estrela; a classe passa a sair da posição na tabela.</p>
        </Painel>
      </section>

      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" style={inputStyle} />

      <div>
        <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: T.fraco }}>Ordenar por</span>
        <div className="flex gap-1.5">
          {[["alfabetica", "A → Z"], ["classificacao", "Classificação"], ["posicao", "Goleiros primeiro"]].map(([v, r]) => (
            <button key={v} onClick={() => setOrdem(v)} className="flex-1 rounded-full"
              style={{
                padding: "9px 6px", minHeight: 42, fontSize: 11.5, fontWeight: 800,
                background: ordem === v ? `linear-gradient(180deg,${T.ouroClaro},${T.ouro})` : "rgba(255,255,255,.07)",
                color: ordem === v ? "#07204a" : T.secundario
              }}>{r}</button>
          ))}
        </div>
      </div>

      <section>
        <Secao titulo="Elenco" detalhe={`${base.jogadores.filter((j) => j.ativo !== false && !j.convidado).length} ativos de ${base.jogadores.filter((j) => !j.convidado).length}`} />
        <div className="space-y-2">
          {visiveis.map((j) => {
            const l = porId[j.id];
            const aberto = editando === j.id;
            const inativo = j.ativo === false;
            const badges = [
              inativo && { r: "INATIVO", c: T.fraco },
              j.convidado && { r: "CONVIDADO", c: T.roxo },
              j.pendenciaFinanceira && { r: "$ DEVENDO", c: T.vermelho },
              j.pontuacaoPendente && { r: "(*) A CONFIRMAR", c: T.laranja },
            ].filter(Boolean);
            return (
              <Painel key={j.id} style={{ borderColor: aberto ? T.ouro : j.convidado ? "rgba(192,140,255,.45)" : T.borda, opacity: inativo && !aberto ? 0.55 : 1 }}>
                <div className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5" style={{ fontWeight: 700, fontSize: 15 }}>
                      {j.posicao === "GOLEIRO" && <IconeGoleiro />}
                      <span className="truncate">{j.nome}</span>
                      <Estrelas n={l?.estrelas || 1} goleiro={j.posicao === "GOLEIRO"} />
                      {l?.nivelAtraso && <SeloAtraso nivel={l.atrasosNoMes} cfg={cfg} mini />}
                    </p>
                    <p style={{ fontSize: 11.5, color: T.secundario, marginTop: 2 }}>
                      {j.convidado ? "fora da classificação" : `${l?.posicao}º geral`} · {l?.pontos} pts · {l?.J} jogos · {l?.gols} gols · {l?.assistencias} ass
                      {l?.cartoesNoCiclo > 0 && <span style={{ color: T.laranja }}> · {l.cartoesNoCiclo}/{cfg.cartoesPorPonto} amarelos</span>}
                    </p>
                    {badges.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {badges.map((b) => (
                          <span key={b.r} style={{ background: `${b.c}22`, border: `1px solid ${b.c}66`, color: b.c, borderRadius: 4, padding: "2px 6px", fontSize: 9.5, fontWeight: 800, letterSpacing: ".04em" }}>{b.r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setEditando(aberto ? null : j.id)} className="shrink-0 rounded-lg"
                    style={{
                      padding: "9px 12px", minHeight: 40, fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em",
                      background: aberto ? `linear-gradient(180deg,${T.ouroClaro},${T.ouro})` : "rgba(255,255,255,.08)",
                      color: aberto ? "#07204a" : T.secundario, border: `1px solid ${aberto ? T.ouro : T.borda}`
                    }}>
                    {aberto ? "FECHAR" : "EDITAR"}
                  </button>
                </div>

                {aberto && (
                  <div className="space-y-2 px-3 pb-3" style={{ borderTop: `1px solid ${T.borda}`, paddingTop: 12 }}>
                    <Segmento titulo="Posição" valor={j.posicao}
                      onChange={(v) => atualizar(j.id, { posicao: v, posicaoInferida: false })}
                      opcoes={[{ valor: "LINHA", rotulo: "Jogador de linha" }, { valor: "GOLEIRO", rotulo: "Goleiro", cor: T.gk }]} />
                    {j.posicaoInferida && <p style={{ fontSize: 10.5, color: T.gk }}>Posição inferida da tabela oficial — confirme tocando numa das duas.</p>}

                    <Interruptor ligado={j.ativo !== false} onChange={() => atualizar(j.id, { ativo: j.ativo === false })}
                      titulo="Ativo no campeonato" cor={T.verde}
                      descricao={j.ativo !== false ? "Aparece na chamada de presença da rodada." : "Não aparece na chamada. Continua na tabela com o histórico."} />

                    <Interruptor ligado={!!j.pendenciaFinanceira} onChange={() => atualizar(j.id, { pendenciaFinanceira: !j.pendenciaFinanceira })}
                      titulo="Pendência financeira ($)" cor={T.vermelho}
                      descricao="Só sinaliza na tabela e na chamada. Não desconta pontos nem bloqueia o sorteio." />

                    <Interruptor ligado={!!j.pontuacaoPendente} onChange={() => atualizar(j.id, { pontuacaoPendente: !j.pontuacaoPendente })}
                      titulo="Pontuação a confirmar (*)" cor={T.laranja}
                      descricao="Marca que os pontos dele aguardam confirmação de pagamento. Só sinalização." />

                    <Interruptor ligado={!!j.convidado} onChange={() => atualizar(j.id, { convidado: !j.convidado })}
                      titulo="Convidado / avulso" cor={T.roxo}
                      descricao={j.convidado ? "Joga e entra na súmula, mas fica fora da classificação." : "Conta normalmente na classificação geral."} />

                    <button onClick={() => {
                      if (l?.temHistorico) return avisar("Tem histórico oficial — desative em vez de excluir");
                      if (base.rodadas.some((r) => (r.times || []).some((t) => idsDoTime(t).includes(j.id)))) return avisar("Tem partidas registradas — desative em vez de excluir");
                      if (confirm(`Excluir ${j.nome} do elenco?`)) { setBase({ ...base, jogadores: base.jogadores.filter((x) => x.id !== j.id) }); setEditando(null); }
                    }} className="w-full rounded-lg"
                      style={{
                        padding: "11px", minHeight: 44, fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
                        background: "rgba(176,33,33,.18)", border: "1px solid rgba(255,107,107,.4)", color: T.vermelho
                      }}>
                      Excluir do elenco
                    </button>
                  </div>
                )}
              </Painel>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ==================== TELA: HISTÓRICO E CONFIGURAÇÕES ====================*/
function Historico({ base, setBase, avisar, nomes, dados }) {
  return (
    <section>
      <Secao titulo="Rodadas registradas" detalhe="reabrir recalcula tudo" />
      <div className="space-y-2">
        {base.historicoInicial?.rodadas > 0 && (
          <Painel className="p-3" style={{ background: T.ouroFraco, borderColor: "rgba(245,197,24,.3)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.ouro }}>Rodadas 1 a {base.historicoInicial.rodadas} — base oficial</p>
            <p style={{ fontSize: 11.5, color: T.secundario }}>{base.historicoInicial.descricao} ({base.historicoInicial.data}).</p>
          </Painel>
        )}
        {[...base.rodadas].sort((a, b) => b.numero - a.numero).map((r) => (
          <Painel key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
            <div className="min-w-0">
              <p style={{ fontSize: 13.5, fontWeight: 700 }}>Rodada {r.numero} {r.status === "aberta" && <span style={{ color: T.ouro }}>· aberta</span>}</p>
              <p className="truncate" style={{ fontSize: 11.5, color: T.secundario }}>
                {r.data} · {(r.jogos || []).map((g) => { const p = placarDe(g, r); return `${p.A}×${p.B}`; }).join(" · ") || "sem partidas"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => { baixarArquivo(`jpffs-sumula-r${r.numero}.csv`, csvSumula(r, nomes, dados.disciplina.porRodada[r.id])); avisar("Súmula exportada"); }}
                style={{ borderRadius: 6, padding: 9, fontSize: 10, fontWeight: 800, textTransform: "uppercase", background: "rgba(255,255,255,.08)", color: T.secundario }}>Súmula</button>
              <button onClick={() => setBase({ ...base, rodadas: base.rodadas.map((x) => x.id === r.id ? { ...x, status: x.status === "aberta" ? "fechada" : "aberta" } : x) })}
                style={{ borderRadius: 6, padding: 9, fontSize: 10, fontWeight: 800, textTransform: "uppercase", background: "rgba(255,255,255,.08)", color: T.secundario }}>{r.status === "aberta" ? "Fechar" : "Reabrir"}</button>
              <button onClick={() => { if (confirm(`Excluir a rodada ${r.numero}? A classificação será recalculada.`)) setBase({ ...base, rodadas: base.rodadas.filter((x) => x.id !== r.id) }); }}
                style={{ borderRadius: 6, padding: "9px 10px", fontSize: 11, fontWeight: 800, background: "rgba(255,255,255,.08)", color: T.vermelho }}>✕</button>
            </div>
          </Painel>
        ))}
        {base.rodadas.length === 0 && <Painel className="p-5 text-center" style={{ borderStyle: "dashed", fontSize: 13, color: T.secundario }}>Nenhuma rodada registrada no app ainda.</Painel>}
      </div>
    </section>
  );
}

function TelaConfig({ base, setBase, dados, cfg, avisar }) {
  const inputRef = useRef(null);
  const [ra, setRa] = useState(""); const [rb, setRb] = useState(""); const [tipo, setTipo] = useState("separados");
  const nomes = Object.fromEntries(base.jogadores.map((j) => [j.id, j.nome]));
  const mudar = (c, v) => setBase({ ...base, config: { ...cfg, [c]: v } });
  const mudarPeso = (c, v) => setBase({ ...base, config: { ...cfg, pesos: { ...cfg.pesos, [c]: Number(v) } } });

  return (
    <div className="space-y-4">
      <Historico {...{ base, setBase, avisar, nomes, dados }} />

      <Painel className="p-3" style={{ borderColor: T.gk, background: T.gkFraco, fontSize: 11.5, lineHeight: 1.55, color: T.secundario }}>
        <b style={{ color: T.gk }}>Goleiros.</b> Agora é um jogador normal: mesma escala de estrela de todo mundo (a posição geral
        na tabela), sorteado junto com a linha e pesando igual no equilíbrio da equipe — pode ter goleiro 5★ com jogador 5★ no mesmo time.
        A única regra fixa é de composição: toda equipe sai com 1 goleiro + 4 de linha. Faltando goleiro, a vaga de meta
        fica em aberto para escolha manual — o sorteio nunca promove um jogador de linha a goleiro, e nunca coloca
        dois goleiros na mesma equipe. Quem excede as vagas vira sobressalente da partida adicional (§10º).
      </Painel>

      <section>
        <Secao titulo="Disciplina" detalhe="Art. 34º §8º · Art. 82º" />
        <Painel className="grid grid-cols-2 gap-2 p-3">
          {[["pontoPerdidoTerceiroAtraso", "Pontos perdidos no 3º atraso", ""],
          ["atrasosParaSuspensao", "Atrasos para suspensão", ""],
          ["cartoesPorPonto", "Amarelos por ciclo", "Art. 82º §1º — padrão 3"],
          ["pontosPorCicloAmarelo", "Pontos por ciclo fechado", ""],
          ["pontosPorVermelho", "Pontos por vermelho", "Art. 82º §3º"],
          ["rodadasPrevistas", "Rodadas do campeonato", ""]].map(([c, r, d]) => (
            <Campo key={c} rotulo={r} dica={d}><input type="number" value={cfg[c]} onChange={(e) => mudar(c, Number(e.target.value))} style={{ ...inputStyle, padding: "10px" }} /></Campo>
          ))}
          {[["amareloNoSegundoAtraso", "2º atraso gera cartão amarelo na classificação"],
          ["converterSegundoAmarelo", "2º amarelo, ou amarelo + azul, vira vermelho na mesma partida (Art. 81º §Único)"],
          ["perdePontoNoQuartoAtraso", "Cobrar ponto extra do suspenso (premissa em aberto)"]].map(([c, r]) => (
            <div key={c} className="col-span-2">
              <button onClick={() => mudar(c, !cfg[c])} className="w-full rounded-lg p-3 text-left"
                style={{ border: `1px solid ${cfg[c] ? T.ouro : T.borda}`, background: cfg[c] ? T.ouroFraco : "rgba(0,0,0,.2)", fontSize: 12.5, color: cfg[c] ? T.ouroClaro : T.secundario }}>
                {cfg[c] ? "☑ " : "☐ "}{r}
              </button>
            </div>
          ))}
        </Painel>
      </section>

      <section>
        <Secao titulo="Motor de sorteio" detalhe="§12º — goleiro e linha juntos" />
        <Painel className="grid grid-cols-2 gap-2 p-3">
          {[["amplitude", "Diferença máx."], ["desvio", "Desvio padrão"], ["varianciaInterna", "Composição interna"],
          ["faixa", "Distribuição por faixa"], ["repeticao", "Anti-repetição"], ["aproveitamento", "Aproveitamento %"]].map(([c, r]) => (
            <Campo key={c} rotulo={r}><input type="number" value={cfg.pesos[c]} onChange={(e) => mudarPeso(c, e.target.value)} style={{ ...inputStyle, padding: "10px" }} /></Campo>
          ))}
          <div className="col-span-2">
            <button onClick={() => mudar("usarAproveitamento", !cfg.usarAproveitamento)} className="w-full rounded-lg p-3 text-left"
              style={{ border: `1px solid ${cfg.usarAproveitamento ? T.ouro : T.borda}`, background: cfg.usarAproveitamento ? T.ouroFraco : "rgba(0,0,0,.2)", fontSize: 12.5, color: cfg.usarAproveitamento ? T.ouroClaro : T.secundario }}>
              {cfg.usarAproveitamento ? "☑ " : "☐ "}Equilibrar também o aproveitamento %
            </button>
          </div>
          {[["rodadasAntiRepeticao", "Anti-repetição (rodadas)"], ["jogadoresPorTime", "Jogadores por equipe"],
          ["goleirosPorTime", "Goleiros por equipe"]].map(([c, r]) => (
            <Campo key={c} rotulo={r}><input type="number" value={cfg[c]} onChange={(e) => mudar(c, Number(e.target.value))} style={{ ...inputStyle, padding: "10px" }} /></Campo>
          ))}
        </Painel>
      </section>

      <section>
        <Secao titulo="Restrições por par" detalhe={`${(base.restricoes || []).length} regra(s)`} />
        <Painel className="space-y-2 p-3">
          {(base.restricoes || []).map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded px-2 py-1.5" style={{ background: "rgba(0,0,0,.25)", fontSize: 12 }}>
              <span className="truncate" style={{ color: T.secundario }}>{nomes[r.a]} <span style={{ color: r.tipo === "juntos" ? T.verde : T.vermelho }}>{r.tipo === "juntos" ? "sempre com" : "nunca com"}</span> {nomes[r.b]}</span>
              <button onClick={() => setBase({ ...base, restricoes: base.restricoes.filter((x) => x.id !== r.id) })} style={{ color: T.fraco }}>✕</button>
            </div>
          ))}
          <div className="flex gap-1.5">
            <select value={ra} onChange={(e) => setRa(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "10px 4px", fontSize: 12 }}>
              <option value="">Jogador A</option>{base.jogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
            </select>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "10px 4px", fontSize: 12 }}>
              <option value="separados">nunca com</option><option value="juntos">sempre com</option>
            </select>
            <select value={rb} onChange={(e) => setRb(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "10px 4px", fontSize: 12 }}>
              <option value="">Jogador B</option>{base.jogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
            </select>
          </div>
          <Botao className="w-full" onClick={() => {
            if (!ra || !rb || ra === rb) return avisar("Escolha dois jogadores diferentes");
            setBase({ ...base, restricoes: [...(base.restricoes || []), { id: id(), a: ra, b: rb, tipo }] });
            setRa(""); setRb("");
          }}>Adicionar restrição</Botao>
        </Painel>
      </section>

      <section>
        <Secao titulo="Pontuação" />
        <Painel className="grid grid-cols-2 gap-2 p-3">
          {[["pontosVitoria", "Pontos por vitória"], ["pontosEmpate", "Pontos por empate"],
          ["pontosPresenca", "Pontos por presença"], ["tetoPorRodada", "Teto por rodada"],
          ["zonaSupercopa", "Supercopa: nº de linha"], ["goleirosSupercopa", "Supercopa: nº de goleiros"]].map(([c, r]) => (
            <Campo key={c} rotulo={r}><input type="number" value={cfg[c]} onChange={(e) => mudar(c, Number(e.target.value))} style={{ ...inputStyle, padding: "10px" }} /></Campo>
          ))}
          <div className="col-span-2">
            <Campo rotulo="Base do aproveitamento" dica="Realizadas reproduz a tabela oficial.">
              <select value={cfg.baseAproveitamento} onChange={(e) => mudar("baseAproveitamento", e.target.value)} style={{ ...inputStyle, padding: "10px", fontSize: 13 }}>
                <option value="realizadas">Rodadas realizadas ({dados.rodadasRealizadas})</option>
                <option value="previstas">Rodadas previstas ({cfg.rodadasPrevistas})</option>
              </select>
            </Campo>
          </div>
        </Painel>
      </section>

      <section>
        <Secao titulo="Campeões Copa Hendor" detalhe="2 vagas garantidas na Supercopa" />
        <Painel className="space-y-2 p-3">
          <p style={{ fontSize: 11.5, lineHeight: 1.5, color: T.fraco }}>
            Os 2 campeões da Copa Hendor de Penalidades entram na zona da Supercopa mesmo se estiverem fora do corte por pontos.
            Se já estiverem classificados por mérito, nada muda. Vale para qualquer jogador — inclusive goleiro, que aí disputa
            a vaga extra com os outros goleiros, nunca com a linha. Deixe em branco enquanto a final não acontece.
          </p>
          {[0, 1].map((i) => (
            <Campo key={i} rotulo={`Campeão ${i + 1}`}>
              <select
                value={(cfg.campeoesHendor || [])[i] || ""}
                onChange={(e) => {
                  const atual = [...(cfg.campeoesHendor || [])];
                  atual[i] = e.target.value || null;
                  // Mantém os 2 índices fixos (Campeão 1 / Campeão 2) mesmo com
                  // buracos — compactar aqui trocaria o Campeão 2 de lugar caso
                  // o Campeão 1 fosse limpo.
                  mudar("campeoesHendor", atual);
                }}
                style={{ ...inputStyle, padding: "10px", fontSize: 13 }}>
                <option value="">— a definir —</option>
                {base.jogadores.filter((j) => !j.convidado).map((j) => (
                  <option key={j.id} value={j.id}>{j.nome}{j.posicao === "GOLEIRO" ? " (GK)" : ""}</option>
                ))}
              </select>
            </Campo>
          ))}
        </Painel>
      </section>

      <section>
        <Secao titulo="Backup e transferência" />
        <Painel className="space-y-2 p-3">
          <Botao className="w-full" onClick={() => { baixarArquivo(`jpffs-base-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(base, null, 2), "application/json"); avisar("Base exportada"); }}>
            Exportar base completa (JSON)
          </Botao>
          <Botao variante="secundario" className="w-full" onClick={() => inputRef.current?.click()}>Importar base (JSON)</Botao>
          <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const fr = new FileReader();
            fr.onload = () => {
              try {
                const d = JSON.parse(fr.result);
                if (!Array.isArray(d.jogadores) || !Array.isArray(d.rodadas)) throw new Error();
                setBase(migrarBase(d)); avisar(`Base importada · ${d.jogadores.length} jogadores`);
              } catch { avisar("Arquivo inválido. Use um JSON exportado pelo sistema."); }
            };
            fr.readAsText(f); e.target.value = "";
          }} />
          <p style={{ fontSize: 11.5, lineHeight: 1.5, color: T.fraco }}>
            Salvo neste dispositivo, funciona sem internet. A classificação nunca é armazenada — é sempre recalculada.
          </p>
        </Painel>
      </section>

      <Botao variante="secundario" className="w-full" onClick={async () => {
        if (!confirm("Restaurar todas as regras dos Ajustes para o padrão? Suas rodadas e jogadores NÃO são afetados — só os parâmetros voltam ao original.")) return;
        const { data: s } = await supabase.auth.getSession();
        if (!s?.session) { alert("Você precisa estar logado para restaurar."); return; }
        const novaBase = { ...base, config: { ...CONFIG_PADRAO } };
        const { error } = await supabase.from("base")
          .update({ dados: novaBase, atualizado_em: new Date().toISOString(), atualizado_por: s.session.user.email || null })
          .eq("id", 1);
        if (error) { alert("Falha ao restaurar: " + error.message); return; }
        avisar("Regras restauradas — recarregando…");
        setTimeout(() => window.location.reload(), 400);
      }}>Restaurar regras-padrão</Botao>

      <Botao variante="perigo" className="w-full" onClick={async () => {
        if (!confirm("Recarregar a base oficial da 21ª rodada? Todas as rodadas lançadas no app serão perdidas em TODOS os dispositivos.")) return;
        const { data: s } = await supabase.auth.getSession();
        if (!s?.session) { alert("Você precisa estar logado para restaurar."); return; }
        const oficial = baseOficial();
        // Grava DIRETO no Supabase, sem passar pelo salvamento com debounce,
        // que poderia ser sobrescrito pelo sincronizador antes de gravar.
        const { error } = await supabase.from("base")
          .update({ dados: oficial, atualizado_em: new Date().toISOString(), atualizado_por: s.session.user.email || null })
          .eq("id", 1);
        if (error) { alert("Falha ao restaurar: " + error.message); return; }
        // Limpa o backup local para não conflitar
        try { localStorage.removeItem("jpffs:backup"); } catch { }
        avisar("Base oficial restaurada — recarregando…");
        setTimeout(() => window.location.reload(), 400);
      }}>Restaurar base oficial</Botao>
      <p className="pb-4 text-center" style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(255,255,255,.18)" }}>Campeonato JPFFS · {base.temporada}</p>
    </div>
  );
}
