// FlowServe Social: configuración central de paquetes y precios.
// La usan la página /social-media/ (tarjetas, calculadora, formulario) y /api/social/enquiry (validación).
// Para cambiar un precio o un paquete, edítalo SOLO aquí.

export const CURRENCY = 'EUR';
export const VAT_NOTE = { en: 'Prices exclude VAT.', es: 'Precios sin IVA.' };

/** Paquetes de redes sociales (servicio gestionado, mensual). */
export const SOCIAL_PACKAGES = [
  {
    id: 'social-starter',
    name: 'Social Starter',
    price: 299,
    from: false,
    popular: false,
    audience: { en: 'For independent professionals and small businesses', es: 'Para profesionales independientes y negocios pequeños' },
    features: [
      { en: '8 feed posts per month, in total across Instagram and Facebook', es: '8 publicaciones al mes en total, entre Instagram y Facebook' },
      { en: 'Captions, hashtags and basic branded creative design', es: 'Textos, hashtags y diseño básico con tu marca' },
      { en: 'Monthly content calendar', es: 'Calendario de contenido mensual' },
      { en: 'Scheduling of approved posts', es: 'Programación de las publicaciones aprobadas' },
      { en: 'One revision round per post', es: 'Una ronda de cambios por publicación' },
      { en: 'You supply the photos and video footage', es: 'Tú aportas las fotos y los vídeos' },
    ],
  },
  {
    id: 'social-growth',
    name: 'Social Growth',
    price: 499,
    from: false,
    popular: true,
    audience: { en: 'For salons and studios that want to post more and promote offers', es: 'Para salones y estudios que quieren publicar más y promocionar ofertas' },
    features: [
      { en: '12 feed posts per month, in total across Instagram and Facebook', es: '12 publicaciones al mes en total, entre Instagram y Facebook' },
      { en: 'Up to 4 Story sets per month', es: 'Hasta 4 series de Stories al mes' },
      { en: 'More tailored creative design and promotional content', es: 'Diseño más personalizado y contenido promocional' },
      { en: 'Monthly content calendar and scheduling', es: 'Calendario mensual y programación' },
      { en: 'One revision round per post', es: 'Una ronda de cambios por publicación' },
      { en: 'Basic monthly performance report', es: 'Informe mensual básico de resultados' },
    ],
  },
  {
    id: 'social-premium',
    name: 'Social Premium',
    price: 699,
    from: true,
    popular: false,
    audience: { en: 'For businesses that need more content and ongoing support', es: 'Para negocios que necesitan más contenido y apoyo continuo' },
    features: [
      { en: 'Up to 16 feed posts per month, in total across platforms', es: 'Hasta 16 publicaciones al mes en total, entre plataformas' },
      { en: 'Up to 4 simple edited Reels per month, from footage you supply', es: 'Hasta 4 Reels sencillos editados al mes, con vídeos que tú aportas' },
      { en: 'Planned Stories and promotional campaigns', es: 'Stories planificadas y campañas promocionales' },
      { en: 'Limited community management, within agreed hours and volume', es: 'Gestión de comunidad limitada, en horario y volumen acordados' },
      { en: 'Monthly performance report and review meeting', es: 'Informe mensual de resultados y reunión de revisión' },
    ],
  },
];

/** Planes de automatización que se pueden sumar como complemento (no se mezclan con los de Social). */
export const AUTOMATION_ADDONS = [
  {
    id: 'front-desk',
    name: 'FlowServe Front Desk',
    price: 249,
    from: false,
    href: '/#pricing',
    summary: { en: 'AI receptionist, reminders, waiting list and weekly report', es: 'Recepcionista IA, recordatorios, lista de espera e informe semanal' },
  },
];

/**
 * Descuentos por combinar servicios. Vacío = no se aplica ninguno.
 * Formato: { id, requires: ['social-growth','front-desk'], amount: 50, label: { en, es } }
 */
export const BUNDLE_DISCOUNTS = [];

/** Condiciones que se muestran en todos los paquetes. */
export const PACKAGE_TERMS = [
  { en: 'Post quantities are the total across the platforms you choose, not per platform.', es: 'Las cantidades de publicaciones son el total entre las plataformas que elijas, no por plataforma.' },
  { en: 'Paid advertising spend is not included.', es: 'La inversión en publicidad pagada no está incluida.' },
  { en: 'Photo sessions, on-site filming, advanced video production and extra work are quoted separately.', es: 'Sesiones de fotos, grabaciones en el local, producción de vídeo avanzada y trabajo extra se presupuestan aparte.' },
  { en: 'Community management (Premium only) has agreed limits on hours and volume.', es: 'La gestión de comunidad (solo Premium) tiene límites acordados de horas y volumen.' },
  { en: 'Every post needs your approval before it is published.', es: 'Cada publicación necesita tu aprobación antes de publicarse.' },
  { en: 'Publishing depends on your account’s eligibility and on the platform integrations working. Until then we schedule with approved external tools.', es: 'La publicación depende de que tu cuenta sea apta y de que funcionen las integraciones de cada plataforma. Mientras tanto, programamos con herramientas externas aprobadas.' },
];

/** Opciones del formulario (los valores son los que valida el servidor). */
export const FORM_OPTIONS = {
  category: [
    ['beauty-salon', { en: 'Beauty salon', es: 'Salón de belleza' }],
    ['aesthetic-clinic', { en: 'Aesthetic clinic', es: 'Clínica estética' }],
    ['massage-wellness', { en: 'Massage or wellness', es: 'Masaje o bienestar' }],
    ['nails-brows-lashes', { en: 'Nails, brows or lashes', es: 'Uñas, cejas o pestañas' }],
    ['hair-salon', { en: 'Hair salon', es: 'Peluquería' }],
    ['other', { en: 'Other beauty & wellness', es: 'Otro de belleza y bienestar' }],
  ],
  objective: [
    ['awareness', { en: 'Brand awareness', es: 'Dar a conocer la marca' }],
    ['enquiries', { en: 'More enquiries', es: 'Más consultas' }],
    ['bookings', { en: 'More bookings', es: 'Más reservas' }],
    ['retention', { en: 'Customer retention', es: 'Fidelizar clientes' }],
    ['promotions', { en: 'Promotions', es: 'Promociones' }],
  ],
  frequency: [
    ['none', { en: 'Not posting at the moment', es: 'Ahora no publico' }],
    ['monthly', { en: 'A few times a month', es: 'Unas pocas veces al mes' }],
    ['weekly', { en: 'About once a week', es: 'Más o menos una vez por semana' }],
    ['several-weekly', { en: 'Several times a week', es: 'Varias veces por semana' }],
  ],
  media: [
    ['yes', { en: 'Yes, I can send photos and videos', es: 'Sí, puedo enviar fotos y vídeos' }],
    ['some', { en: 'Some, but not regularly', es: 'Algunas, pero no con regularidad' }],
    ['no', { en: 'No, I would need help with this', es: 'No, necesitaría ayuda con esto' }],
  ],
  language: [
    ['en', { en: 'English', es: 'Inglés' }],
    ['es', { en: 'Spanish', es: 'Español' }],
  ],
};

export const packageById = (id) => SOCIAL_PACKAGES.find((p) => p.id === id) || null;
export const addonById = (id) => AUTOMATION_ADDONS.find((a) => a.id === id) || null;

/**
 * Desglose mensual de una selección. Devuelve líneas, descuentos y total.
 * `from` es true si algún precio es "desde" (el total también será "desde").
 */
export function quote(packageId, addonIds = []) {
  const lines = [];
  const pkg = packageById(packageId);
  if (pkg) lines.push({ id: pkg.id, name: pkg.name, price: pkg.price, from: pkg.from });
  for (const id of addonIds) { const a = addonById(id); if (a) lines.push({ id: a.id, name: a.name, price: a.price, from: a.from }); }
  const ids = lines.map((l) => l.id);
  const discounts = BUNDLE_DISCOUNTS.filter((d) => d.requires.every((r) => ids.includes(r)));
  const subtotal = lines.reduce((s, l) => s + l.price, 0);
  const off = discounts.reduce((s, d) => s + d.amount, 0);
  return { lines, discounts, subtotal, total: Math.max(0, subtotal - off), from: lines.some((l) => l.from) };
}
