
export enum BoxStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SEALED = 'SEALED',
  IN_TRANSIT = 'IN_TRANSIT',
  RECEIVED = 'RECEIVED'
}

export enum ItemStatus {
  SCANNED = 'SCANNED',
  DELIVERED = 'DELIVERED'
}

export interface Item {
  id: string;
  barcode: string;
  timestamp: number;
  status: ItemStatus;
}

export interface TransportBox {
  id: string;
  barcode: string;
  status: BoxStatus;
  items: Item[];
  startLocation: string;
  createdAt: number;
  sealedAt?: number;
  inTransitAt?: number;
  receivedAt?: number;
}

export interface Location {
  id: string;
  name: string;
}

export type View = 'DASHBOARD' | 'SCANNER' | 'BOX_DETAIL' | 'SETTINGS';
