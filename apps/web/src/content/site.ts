export const site = {
  name: "Carlos Eduardo Araujo Morais",
  shortName: "Carlos Morais",
  // Used to keep the age on the hero caption current (the home page revalidates daily).
  birthDate: "2003-04-03",
  email: "carlos13bem@gmail.com",
  // wa.me expects digits only, country code first.
  whatsapp: "5563992046146",
  linkedin: "https://www.linkedin.com/in/carlos-m-678974245",
  github: "https://github.com/carloMorais",
  sourceRepo: "https://github.com/carloMorais/portfolio",
} as const;

export const contactLinks = [
  { id: "email", label: "E-mail", href: `mailto:${site.email}` },
  { id: "linkedin", label: "LinkedIn", href: site.linkedin },
  { id: "github", label: "GitHub", href: site.github },
  { id: "whatsapp", label: "WhatsApp", href: `https://wa.me/${site.whatsapp}` },
] as const;
