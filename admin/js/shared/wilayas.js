// Les 58 wilayas d'Algérie + tarifs de livraison par défaut (modifiables dans l'admin > Livraison)
export const WILAYAS = [
  [1, 'Adrar'], [2, 'Chlef'], [3, 'Laghouat'], [4, 'Oum El Bouaghi'], [5, 'Batna'], [6, 'Béjaïa'],
  [7, 'Biskra'], [8, 'Béchar'], [9, 'Blida'], [10, 'Bouira'], [11, 'Tamanrasset'], [12, 'Tébessa'],
  [13, 'Tlemcen'], [14, 'Tiaret'], [15, 'Tizi Ouzou'], [16, 'Alger'], [17, 'Djelfa'], [18, 'Jijel'],
  [19, 'Sétif'], [20, 'Saïda'], [21, 'Skikda'], [22, 'Sidi Bel Abbès'], [23, 'Annaba'], [24, 'Guelma'],
  [25, 'Constantine'], [26, 'Médéa'], [27, 'Mostaganem'], [28, "M'Sila"], [29, 'Mascara'], [30, 'Ouargla'],
  [31, 'Oran'], [32, 'El Bayadh'], [33, 'Illizi'], [34, 'Bordj Bou Arréridj'], [35, 'Boumerdès'], [36, 'El Tarf'],
  [37, 'Tindouf'], [38, 'Tissemsilt'], [39, 'El Oued'], [40, 'Khenchela'], [41, 'Souk Ahras'], [42, 'Tipaza'],
  [43, 'Mila'], [44, 'Aïn Defla'], [45, 'Naâma'], [46, 'Aïn Témouchent'], [47, 'Ghardaïa'], [48, 'Relizane'],
  [49, 'Timimoun'], [50, 'Bordj Badji Mokhtar'], [51, 'Ouled Djellal'], [52, 'Béni Abbès'], [53, 'In Salah'],
  [54, 'In Guezzam'], [55, 'Touggourt'], [56, 'Djanet'], [57, "El M'Ghair"], [58, 'El Meniaa'],
].map(([code, name]) => ({ code, name }));

const NEAR = [9, 35, 42, 10, 15, 26, 44];
const PLATEAUX = [3, 5, 7, 12, 14, 17, 20, 28, 32, 38, 40, 45, 51];
const SOUTH = [1, 8, 30, 39, 47, 49, 52, 55, 57, 58];
const FAR = [11, 33, 37, 50, 53, 54, 56];

export function defaultFees(code) {
  if (code === 16) return { home: 400, desk: 250, active: true };
  if (NEAR.includes(code)) return { home: 600, desk: 400, active: true };
  if (FAR.includes(code)) return { home: 1500, desk: 900, active: true };
  if (SOUTH.includes(code)) return { home: 1100, desk: 700, active: true };
  if (PLATEAUX.includes(code)) return { home: 800, desk: 500, active: true };
  return { home: 700, desk: 450, active: true };
}

export const wilayaName = (code) => WILAYAS.find((w) => w.code === Number(code))?.name || '';

/** Tarif réel d'une wilaya en tenant compte des réglages publiés */
export function feesFor(settings, code) {
  const custom = settings?.delivery?.[code] || settings?.delivery?.[String(code)];
  return { ...defaultFees(Number(code)), ...(custom || {}) };
}
