export type Teammate = {
  name: string;
  title: string;
  company: string;
  linkedin: string;
  photo: string;
};

export const TEAM: Teammate[] = [
  {
    name: "Pranav Narahari",
    title: "Forward Deployed Engineer",
    company: "Innovaccer",
    linkedin: "https://www.linkedin.com/in/pranavnarahari/",
    photo: "/team/pranav.jpg",
  },
  {
    name: "Aurora Quinn-Elmore",
    title: "VP, AI Solutions",
    company: "AgentPress",
    linkedin: "https://www.linkedin.com/in/auroraquinnelmore/",
    photo: "/team/aurora.jpg",
  },
  {
    name: "Travis Mathis",
    title: "Cybersecurity Analyst",
    company: "138 Welding and Inspection Services",
    linkedin: "https://www.linkedin.com/in/travismathis138",
    photo: "/team/travis.svg",
  },
  {
    name: "Bo Lora",
    title: "Strategic Advisor",
    company: "Bolora.me",
    linkedin: "https://www.linkedin.com/in/bolora",
    photo: "/team/bo.png",
  },
];

export function profilePath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
}
