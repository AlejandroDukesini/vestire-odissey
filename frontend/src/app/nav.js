import {
  LayoutDashboard, Shirt, Glasses, ScanEye, Watch, Landmark, Building2, Wallet, Settings, Ship, Car, Bike, Home, Globe,
} from 'lucide-react'

// Secciones de colección: cada pestaña corresponde a una categoría (kind) del catálogo.
export const SECTIONS = {
  vestimenta: { path: '/vestimenta', title: 'Vestimenta', eyebrow: 'Guardarropa', tabs: [{ slug: null, kind: 'garment', icon: Shirt }] },
  accesorios: { path: '/accesorios', title: 'Accesorios', eyebrow: 'Guardarropa', tabs: [{ slug: null, kind: 'accessory', icon: Glasses }] },
  relojes: { path: '/relojes', title: 'Relojes', eyebrow: 'Colección', tabs: [{ slug: null, kind: 'watch', icon: Watch }] },
  propiedades: {
    path: '/propiedades', title: 'Propiedades', eyebrow: 'Patrimonio',
    tabs: [
      { slug: 'yates', kind: 'yacht', icon: Ship },
      { slug: 'automoviles', kind: 'car', icon: Car },
      { slug: 'motocicletas', kind: 'motorcycle', icon: Bike },
      { slug: 'casas', kind: 'house', icon: Home },
    ],
  },
  empresas: {
    path: '/empresas', title: 'Empresas', eyebrow: 'Negocios',
    tabs: [
      { slug: 'fisicas', kind: 'physicalBusiness', icon: Building2 },
      { slug: 'digitales', kind: 'digitalBusiness', icon: Globe },
    ],
  },
}

export const NAV = [
  { group: null, items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    group: 'Guardarropa',
    items: [
      { to: '/vestimenta', label: 'Vestimenta', icon: Shirt },
      { to: '/accesorios', label: 'Accesorios', icon: Glasses },
      { to: '/previsualizaciones', label: 'Previsualizaciones', icon: ScanEye },
    ],
  },
  { group: 'Colección', items: [{ to: '/relojes', label: 'Relojes', icon: Watch }] },
  {
    group: 'Patrimonio',
    items: [
      { to: '/propiedades', label: 'Propiedades', icon: Landmark },
      { to: '/empresas', label: 'Empresas', icon: Building2 },
      { to: '/ingresos', label: 'Fuentes de ingresos', icon: Wallet },
    ],
  },
  { group: null, items: [{ to: '/ajustes', label: 'Configuración', icon: Settings }] },
]

/** Ruta de la ficha de un activo. */
export function itemPath(item) {
  for (const s of Object.values(SECTIONS)) {
    const tab = s.tabs.find((t) => t.kind === item.kind)
    if (tab) return `${s.path}${tab.slug ? `/${tab.slug}` : ''}/${item.id}`
  }
  return '/'
}

/** Ruta del listado de una categoría (con ?nuevo=1 abre directamente el formulario). */
export function kindListPath(kind, { create = false } = {}) {
  for (const s of Object.values(SECTIONS)) {
    const tab = s.tabs.find((t) => t.kind === kind)
    if (tab) return `${s.path}${tab.slug ? `/${tab.slug}` : ''}${create ? '?nuevo=1' : ''}`
  }
  return '/'
}
