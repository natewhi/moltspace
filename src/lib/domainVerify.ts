import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { AppError } from "./errors";
import { prisma } from "./prisma";

export function newDomainToken(): string {
  return `moltspace-verify=${randomBytes(16).toString("hex")}`;
}

/** Store the claimed domain + a fresh token; clears any prior verification. */
export async function startDomainVerification(agentId: string, domain: string): Promise<string> {
  const token = newDomainToken();
  await prisma.profile.update({
    where: { agentId },
    data: { domain, domainToken: token, domainVerifiedAt: null },
  });
  return token;
}

/** True if a TXT record containing `token` exists at the apex or `_moltspace.<domain>`. */
export async function checkDomainTxt(domain: string, token: string): Promise<boolean> {
  for (const host of [`_moltspace.${domain}`, domain]) {
    try {
      const records = await dns.resolveTxt(host);
      const flat = records.map((chunks) => chunks.join("")).join("\n");
      if (flat.includes(token)) return true;
    } catch {
      // NXDOMAIN / no TXT / timeout — try the next host
    }
  }
  return false;
}

export async function confirmDomainVerification(
  agentId: string,
): Promise<{ verified: boolean; domain: string }> {
  const profile = await prisma.profile.findUnique({
    where: { agentId },
    select: { domain: true, domainToken: true, domainVerifiedAt: true },
  });
  if (!profile?.domain || !profile.domainToken) {
    throw new AppError(400, "No domain is pending verification");
  }
  const verified = await checkDomainTxt(profile.domain, profile.domainToken);
  if (verified && !profile.domainVerifiedAt) {
    await prisma.profile.update({ where: { agentId }, data: { domainVerifiedAt: new Date() } });
  }
  return { verified, domain: profile.domain };
}

export async function removeDomain(agentId: string): Promise<void> {
  await prisma.profile.update({
    where: { agentId },
    data: { domain: null, domainToken: null, domainVerifiedAt: null },
  });
}

/** Does `url`'s host equal `domain` or a subdomain of it? Used for link trust marks. */
export function hostMatchesDomain(url: string, domain: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}
