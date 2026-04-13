/**
 * Czech regions (kraje) — approximate center points and simplified boundary polygons
 * for map label and boundary overlay.
 */

export interface CzechRegion {
  name: string;
  code: string;
  center: [number, number]; // [lat, lng]
  // Simplified boundary polygon [lat, lng][]
  boundary: [number, number][];
}

export const CZECH_REGIONS: CzechRegion[] = [
  {
    name: 'Praha',
    code: 'PHA',
    center: [50.075, 14.437],
    boundary: [
      [50.17, 14.22], [50.17, 14.65], [50.00, 14.65], [50.00, 14.22],
    ],
  },
  {
    name: 'Středočeský',
    code: 'STC',
    center: [49.87, 14.78],
    boundary: [
      [50.40, 13.68], [50.40, 15.30], [49.56, 15.30], [49.56, 13.68],
    ],
  },
  {
    name: 'Jihočeský',
    code: 'JHC',
    center: [49.05, 14.43],
    boundary: [
      [49.56, 13.50], [49.56, 15.10], [48.55, 15.10], [48.55, 13.50],
    ],
  },
  {
    name: 'Plzeňský',
    code: 'PLK',
    center: [49.73, 13.38],
    boundary: [
      [50.10, 12.65], [50.10, 13.90], [49.30, 13.90], [49.30, 12.65],
    ],
  },
  {
    name: 'Karlovarský',
    code: 'KVK',
    center: [50.23, 12.87],
    boundary: [
      [50.50, 12.35], [50.50, 13.30], [49.95, 13.30], [49.95, 12.35],
    ],
  },
  {
    name: 'Ústecký',
    code: 'ULK',
    center: [50.56, 13.97],
    boundary: [
      [50.95, 13.10], [50.95, 14.60], [50.25, 14.60], [50.25, 13.10],
    ],
  },
  {
    name: 'Liberecký',
    code: 'LBK',
    center: [50.72, 15.01],
    boundary: [
      [50.95, 14.45], [50.95, 15.55], [50.48, 15.55], [50.48, 14.45],
    ],
  },
  {
    name: 'Královéhradecký',
    code: 'HKK',
    center: [50.35, 15.83],
    boundary: [
      [50.80, 15.25], [50.80, 16.40], [50.10, 16.40], [50.10, 15.25],
    ],
  },
  {
    name: 'Pardubický',
    code: 'PAK',
    center: [49.93, 16.07],
    boundary: [
      [50.20, 15.50], [50.20, 16.70], [49.60, 16.70], [49.60, 15.50],
    ],
  },
  {
    name: 'Vysočina',
    code: 'VYS',
    center: [49.40, 15.59],
    boundary: [
      [49.70, 14.95], [49.70, 16.30], [49.05, 16.30], [49.05, 14.95],
    ],
  },
  {
    name: 'Jihomoravský',
    code: 'JHM',
    center: [49.00, 16.61],
    boundary: [
      [49.45, 15.80], [49.45, 17.35], [48.60, 17.35], [48.60, 15.80],
    ],
  },
  {
    name: 'Olomoucký',
    code: 'OLK',
    center: [49.80, 17.13],
    boundary: [
      [50.20, 16.50], [50.20, 17.60], [49.45, 17.60], [49.45, 16.50],
    ],
  },
  {
    name: 'Zlínský',
    code: 'ZLK',
    center: [49.22, 17.67],
    boundary: [
      [49.55, 17.20], [49.55, 18.20], [48.85, 18.20], [48.85, 17.20],
    ],
  },
  {
    name: 'Moravskoslezský',
    code: 'MSK',
    center: [49.82, 18.17],
    boundary: [
      [50.15, 17.55], [50.15, 18.85], [49.45, 18.85], [49.45, 17.55],
    ],
  },
];
