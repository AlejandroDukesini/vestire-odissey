import {
  LayoutDashboard, Shirt, Glasses, ScanEye, Watch, Ship, Car, Bike, Home, Building2, Globe, Wallet, Settings,
} from 'lucide-react'

// Navegación única de la aplicación. `phase` indica en qué fase se entrega el módulo.
export const NAV = [
  { group: null, items: [{ to: '/', label: 'Patrimonio', icon: LayoutDashboard, phase: 6 }] },
  {
    group: 'Vestimenta',
    items: [
      { to: '/vestimenta', label: 'Prendas', icon: Shirt, phase: 3, kind: 'garment' },
      { to: '/accesorios', label: 'Accesorios', icon: Glasses, phase: 3, kind: 'accessory' },
      { to: '/previsualizacion', label: 'Previsualización', icon: ScanEye, phase: 4 },
    ],
  },
  { group: 'Colección', items: [{ to: '/relojes', label: 'Relojes', icon: Watch, phase: 3, kind: 'watch' }] },
  {
    group: 'Propiedades',
    items: [
      { to: '/propiedades/yates', label: 'Yates', icon: Ship, phase: 3, kind: 'yacht' },
      { to: '/propiedades/automoviles', label: 'Automóviles', icon: Car, phase: 3, kind: 'car' },
      { to: '/propiedades/motocicletas', label: 'Motocicletas', icon: Bike, phase: 3, kind: 'motorcycle' },
      { to: '/propiedades/casas', label: 'Casas', icon: Home, phase: 3, kind: 'house' },
    ],
  },
  {
    group: 'Empresas',
    items: [
      { to: '/empresas/fisicas', label: 'Empresas físicas', icon: Building2, phase: 3, kind: 'physicalBusiness' },
      { to: '/empresas/digitales', label: 'Negocios digitales', icon: Globe, phase: 3, kind: 'digitalBusiness' },
    ],
  },
  { group: 'Finanzas', items: [{ to: '/ingresos', label: 'Fuentes de ingreso', icon: Wallet, phase: 3 }] },
  { group: null, items: [{ to: '/ajustes', label: 'Ajustes', icon: Settings, phase: 2 }] },
]

export const ALL_ROUTES = NAV.flatMap((g) => g.items)
