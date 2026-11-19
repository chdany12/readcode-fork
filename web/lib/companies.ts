// Featured companies. Full-color logos in public/logos (from svgl.app; Amazon uses the AWS smile logo).
export const COMPANIES = [
    { name: "Google", logo: "/logos/google.svg" },
    { name: "Amazon", logo: "/logos/amazon.svg" },
    { name: "Meta", logo: "/logos/meta.svg" },
    { name: "Apple", logo: "/logos/apple.svg" },
];

export function logoFor(company: string): string | undefined {
    return COMPANIES.find((c) => c.name === company)?.logo;
}
