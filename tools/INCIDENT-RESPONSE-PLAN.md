# Security Incident Response Plan

**Scope:** Amazon Information retrieved through the Selling Partner API, and
the credentials used to retrieve it.

**Owner:** *[name]* — *[email]*, *[phone]*
**Adopted:** *[date]*
**Last reviewed:** *[date]* · **Next review due:** *[date + 6 months]*

> This is a template. It is only a truthful "Yes" on the Solution Provider
> Profile once someone is named as owner, the dates are filled in, and the
> six-month review actually happens. Fill it in or delete it — an unadopted
> plan on disk is worse than none, because it invites a claim you can't back.

---

## 1. Roles

| Role | Who | Responsibility |
| --- | --- | --- |
| Incident Owner | *[name]* | Declares incidents, runs response, owns all notifications |
| Technical Responder | *[name]* | Revokes credentials, investigates scope, applies fixes |
| Deputy | *[name]* | Acts when the Incident Owner is unavailable |

In a small team one person may hold several roles. Name a deputy regardless,
so response never depends on one person being reachable.

## 2. What counts as an incident

Any actual or suspected:

- Disclosure, loss, or theft of SP-API credentials — LWA client secret,
  refresh token, or access token.
- Unauthorized access to Amazon Information, or to a device or account that
  holds it.
- Unauthorized use of the Amazon seller account or the application.
- Malware, ransomware, or compromise of a device used to run the integration.
- Accidental publication of Amazon Information or credentials, including a
  commit to a public repository.

When it is unclear whether something qualifies, treat it as an incident until
shown otherwise.

## 3. Response

**Immediately — within 1 hour of detection**

1. Rotate the LWA client secret in the Solution Provider Portal and revoke the
   refresh token by re-running **Authorize app**. This invalidates the leaked
   credential; a new refresh token is issued.
2. Delete the local credential and token cache: `~/.amazon-seller.json` and
   `~/.amazon-seller-token.json`.
3. Change the Seller Central password and confirm MFA is enabled.
4. Isolate any affected device from the network.

**Within 24 hours of detection**

5. Notify Amazon at **security@amazon.com**. State what happened, when it was
   detected, which Amazon Information was involved, and what has been done.
   Send this within 24 hours even if the investigation is still open — an
   incomplete report on time beats a complete one late.
6. Notify any other affected party, and any regulator where notification law
   applies.

**Within 5 business days**

7. Determine scope: what data was reachable, over what period, by whom.
8. Apply the corrective fix.
9. Write it up (section 5) and confirm normal operation.

## 4. Contacts

| Who | Where |
| --- | --- |
| Amazon Security | security@amazon.com |
| Amazon Seller Support | Seller Central → Help |
| Incident Owner | *[email]*, *[phone]* |

## 5. Record

Log every incident: detection time and how, what was affected, actions with
timestamps, when Amazon was notified, root cause, and the corrective action.
Keep the log for at least two years.

| Date | Summary | Amazon notified | Root cause | Fix |
| --- | --- | --- | --- | --- |
| | | | | |

## 6. Review

Reviewed every six months by the Incident Owner, and after any incident.
Update the roles table when people change. Record the date at the top of
this document each time.

## 7. Access and credential policy

This section is the written policy the Solution Provider Profile's security
questions ask about. Answering "Yes" to those questions means this is adopted
and followed, not merely on disk.

### Who may access Amazon Information

Access is granted by job duty. Only staff whose role requires Amazon
Information hold Seller Central logins or SP-API credentials, and each person
has their own Seller Central user with permissions scoped to their duties.
Logins are never shared. Access is revoked the day someone changes role or
leaves.

| Person | Access | Granted |
| --- | --- | --- |
| *[name]* | *[Seller Central admin / SP-API credentials]* | *[date]* |

### Passwords and authentication

- Minimum 12 characters, including special characters. Generated and stored
  in a password manager; never reused across services.
- Multi-factor authentication enabled on Seller Central, the Solution
  Provider Portal, and the password manager itself.
- Passwords expire after 365 days and are rotated annually. The rotation is
  a recurring calendar task owned by the Incident Owner.
- The SP-API LWA client secret is rotated at least every 180 days, as Amazon
  requires, on the same recurring schedule.
- Credentials are never sent over email or chat, written down, or stored in
  shared documents.

### Credential storage

- SP-API credentials live in `~/.amazon-seller.json` at mode `600`, or in
  environment variables. Never hard-coded, never committed — `.gitignore`
  covers the credential and token-cache filenames.
- Access tokens are short-lived (one hour) and cached locally only, in
  `~/.amazon-seller-token.json` at mode `600`.
- The LWA client secret and refresh token are treated as production secrets:
  rotated on any suspicion of exposure, per section 3.

### Data handling

- All SP-API traffic is TLS. The integration uses HTTPS exclusively.
- No Restricted (PII) roles are held, so no buyer personal information is
  retrieved. Order data is limited to order-level fields and ship-to region.
- Amazon Information is not sold, published, or used for any purpose other
  than operating our own Amazon business.

### Network controls

*Record what is actually in place. Answer the profile's network question
against this list, and leave a line blank rather than claiming a control you
do not have.*

- Firewall: *[e.g. macOS firewall enabled on all workstations; router NAT
  firewall]*
- Anti-virus / anti-malware: *[e.g. macOS XProtect / Microsoft Defender]*
- IDS/IPS: *[what provides it, or "not implemented"]*
- Network segmentation: *[e.g. separate guest/IoT SSID, or "not
  implemented"]*

### Annual review

Reviewed with section 6, every six months. Confirm the access table is
current, rotations happened, and the network controls list is still accurate.
