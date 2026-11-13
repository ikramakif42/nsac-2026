# ORBIT-LENS — Terms of Service

**Version:** 0.1.0 · **Drafted:** 12 November 2026  
**Status:** Repository-ready pre-launch draft; not yet effective public-service terms.

Companion documents: [NASA and Data-Use Policies](../nasa-policies/README.md), [Aesthetics Guidelines](../aesthetics-guidelines/README.md), [UI Guide](../ui-guide/README.md).

> **Maintainer notice:** Sections 1–15 are proposed visitor-facing terms. Complete the deployment fields and review them against the actual service and applicable law before publishing these as effective terms. Section 16 is an internal launch checklist. These terms are written for ORBIT-LENS; they are not NASA's participant agreement or NASA's website terms.

## Deployment fields — required before activation

- **Legal operator:** `[REQUIRED: legal person or entity responsible for the service]`
- **Project/team:** ORBIT-LENS / Team Schwarzschildren.
- **Service URL:** `[REQUIRED: deployed canonical URL]`
- **Repository URL:** `[REQUIRED: public repository URL]`
- **General and legal contact:** `[REQUIRED: monitored contact]`
- **Private security contact:** `[REQUIRED: private reporting route]`
- **Privacy notice URL:** `[REQUIRED: implemented privacy notice]`
- **Effective date:** `[REQUIRED: actual publication date]`
- **Operator jurisdiction:** `[REQUIRED: country/region; do not infer from team location]`

## 1. About ORBIT-LENS

ORBIT-LENS is an experimental astronomical visualization service for exploring sky regions across available observation epochs. It is intended for education, exploration and preliminary investigation. Its planned capabilities include coordinate searches, observation timelines, image comparisons and metadata inspection. Availability depends on the deployed version and accessible data.

“We,” “us” and “our” refer to the operator identified above. “You” means a person using the hosted service. “Source data” means astronomical observations and metadata supplied by external providers. “Derived output” means images, manifests or other products created through ORBIT-LENS processing.

The service is independently operated. NASA, Caltech/IPAC, IRSA and the SPHEREx mission are not parties to these terms, and use of their resources does not imply endorsement.

## 2. Scope and notice of terms

These terms describe use of the hosted ORBIT-LENS service. Applicable software licenses govern copying, modifying and redistributing repository code. External providers' terms govern their respective services and materials.

We will make the effective terms available from the service navigation. Where an explicit agreement is required for a feature, that feature will present a clear acceptance action before use. Merely viewing this repository draft does not activate a contract with an unidentified operator.

If you do not accept the effective terms applicable to a feature, do not use that feature. Nothing here removes rights that applicable law does not allow us to exclude.

## 3. Eligibility and educational use

You may use the public viewing features where permitted by applicable law. If you cannot legally agree to terms independently, involve a parent, guardian or other legally authorized person as required in your location.

Educators should supervise classroom use appropriately and avoid submitting student personal information. The MVP is designed without individual student profiles or public messaging. Any later addition of accounts, community features or children's personal-data collection requires a fresh review before release.

NASA Space Apps registration and guardian requirements are separate from eligibility to browse ORBIT-LENS.

## 4. Permitted use

You may explore supported datasets, inspect metadata, use supported sharing and download features, and report reproducible issues. You may use source code according to its actual repository license and reuse third-party data according to the rights and conditions applicable to that data.

Keep attribution and provenance with redistributed outputs. Distinguish source observations from ORBIT-LENS processing and from your own subsequent changes. If an output contains simulation labels, quality warnings or processing notes, preserve that context when presenting the output.

No fee or paid-service arrangement is established by this draft. Any future paid feature would require clear pricing and applicable terms before purchase.

## 5. Unacceptable use

You must not:

- Attempt unauthorized access to systems, credentials or nonpublic information.
- Introduce malware, exploit the service or deliberately disrupt other users.
- Bypass reasonable technical access limits or create abusive automated traffic.
- Submit confidential information, credentials or personal data through coordinate fields, issue reports or unsupported upload paths.
- Infringe third-party rights or falsely claim institutional endorsement.
- Present fabricated observations, altered timestamps or simulated imagery as authentic mission measurements.
- Use service resources for unlawful activity.

These hosted-service conditions do not revoke permissions independently granted by an open-source license. Automated scientific use should follow documented interfaces and published limits. If an operation is unavailable or rate-limited, do not evade the restriction through parallel identities or repeated retries.

## 6. Scientific limitations

The service does not confirm the existence, identity, orbit or discovery of any celestial object. A visually changing feature may arise from wavelength differences, calibration, noise, contamination, registration error, image stretch or processing choices.

Observation availability is incomplete and may change. A search returning no results means that no matching observations were returned under those query conditions; it does not prove that an object or phenomenon is absent.

Display images may be resampled, stretched, masked or otherwise transformed. A screenshot is not a substitute for calibrated source products, uncertainty information and a reproducible analysis. Use the metadata and processing manifest where supplied.

Simulated data are generated test or teaching material. External survey overlays are supplementary. Neither establishes the validity of SPHEREx-specific measurements. Missing quality information must not be interpreted as a clean quality assessment.

Before making research claims, independently review the relevant source data, calibration, uncertainty and methods. ORBIT-LENS is not a navigation, mission-control or safety-critical decision service.

## 7. Third-party services and data

ORBIT-LENS may request data from IRSA and other identified astronomical providers. Those providers control their own availability, releases, metadata and conditions of use. The operator cannot guarantee their response time, continued access or compatibility.

Links to external websites are provided for provenance and convenience. Review the destination's terms and privacy practices. Data source rights remain distinct from the license for ORBIT-LENS code.

Relevant references include [IRSA's SPHEREx access documentation](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/) and [IRSA acknowledgment guidance](https://irsa.ipac.caltech.edu/ack.html). These links do not turn the providers into parties to this agreement.

## 8. Intellectual property and attribution

The repository's actual `LICENSE` file will identify the license chosen for original project code. Until that license is committed, do not assume this draft grants a blanket license to repository contents. Dependencies retain their licenses and notices.

Astronomical products, media, fonts, icons, logos and documentation may have different rights. Consult their source records and the project's third-party notices. The project does not claim ownership over NASA identifiers or provider materials merely because they appear in an interface or export.

You retain rights you already have in your original analysis. You receive no broader rights in embedded third-party material than its applicable terms permit. These terms do not require you to transfer ownership of discoveries, ideas or research conclusions to the operator.

Use project and provider names factually. Do not imply that an institution has reviewed or endorsed your interpretation.

## 9. Privacy, local settings and shared links

The effective privacy notice must explain actual collection, use, retention, recipients and contact options. These terms do not replace it.

The intended MVP uses no user accounts and requests no personal profile information. Hosting infrastructure may nevertheless process IP addresses, request times, browser information, error reports and query URLs. The operator must describe the actual configuration rather than promise that no data are collected.

If the interface stores preferences in your browser, it must explain what is stored and provide a reset action. Any optional analytics or consent controls must match the deployed technology and applicable requirements.

Shared exploration links may contain sky coordinates, selected observations, filters and display settings. Anyone with a link may be able to inspect that state. Do not put private notes, credentials or unpublished sensitive material into shareable URLs. A shared link is not a private research notebook.

## 10. User contributions and issue reports

The planned MVP does not provide public user uploads or a community discussion system. If those features are added, their moderation, privacy and contribution rules must be published first.

Repository issues may be public. Remove personal information, tokens and private file paths before posting screenshots or logs. Report security vulnerabilities through the private contact above.

Contributions to the codebase follow the repository's contribution process and declared licenses. Do not submit code or datasets you lack permission to publish. No broad ownership transfer is created solely by sending ordinary feedback.

## 11. Availability, changes and access restrictions

The service is experimental and may be interrupted, limited or retired. We may modify features, supported releases, processing methods and resource limits. Cached files and browser state are not guaranteed permanent storage; keep your own copies of important manifests and source references.

We may limit or suspend access when reasonably necessary to address abuse, security incidents, legal obligations or infrastructure load. Where practical and appropriate, we will explain the reason and provide a contact route to resolve mistakes. Immediate action may be necessary during an incident.

Restrictions on this hosted service do not change existing rights under applicable open-source licenses or permissions obtained directly from data providers.

## 12. Warranties and liability

To the extent permitted by applicable law, the experimental service and its outputs are provided on an “as available” and “as is” basis. We do not promise uninterrupted operation, fitness for a particular research purpose, complete archive coverage or error-free results.

To the extent permitted by applicable law, the operator is not responsible for indirect or consequential losses resulting from use of, or inability to use, the experimental service. This provision does not exclude liability or remedies that cannot lawfully be excluded, including any applicable mandatory consumer protections.

The operator must review this section for its jurisdiction and deployment model before activation. No fixed monetary cap, mandatory arbitration procedure or foreign forum has been invented for an operator whose legal identity is still unknown.

## 13. Ending use and resolving concerns

You may stop using the service at any time and clear locally stored preferences through the provided controls or your browser. This does not necessarily delete infrastructure logs; the privacy notice must explain applicable retention and request procedures.

For service or rights concerns, use the published contact and include enough non-sensitive detail to identify the issue. For a suspected rights violation, identify the affected URL, the material, your relationship to the rights holder and a contact route. Do not send identity documents through public GitHub issues.

No exclusive governing-law or court clause is selected in this draft. Before activation, the operator should determine whether a tailored clause is appropriate while preserving applicable mandatory rights.

## 14. Changes to these terms

Publish a version and effective date for each revision. Keep prior versions in repository history. Provide reasonable notice of material changes through the service where practical and obtain renewed agreement where required. Do not backdate terms or describe undisclosed past processing as if it had already been authorized.

## 15. Contact and independence

General questions, accessibility problems and legal concerns should go to the operator's published contact. Security reports should use the private route.

NASA and archive providers do not provide customer support for ORBIT-LENS. Direct archive-product questions to the provider's own support channels, and application bugs to the ORBIT-LENS team.

## 16. Maintainer activation checklist

This section is operational guidance, not visitor-facing contract language.

- [ ] Replace every required field and verify the contacts are monitored.
- [ ] Confirm the legal operator and review jurisdiction-dependent provisions.
- [ ] Commit the actual code license and third-party notices.
- [ ] Inventory hosting, CDN, analytics, cookies, browser storage and logging.
- [ ] Document actual log fields, retention periods, processors and deletion procedures.
- [ ] Publish a separate privacy notice; do not adopt an invented retention promise.
- [ ] Verify accounts, uploads, payments and analytics are described as actually deployed.
- [ ] Place terms and privacy links in the footer and relevant feature flows.
- [ ] Verify accessibility feedback and private vulnerability reporting routes.
- [ ] Remove draft-only drafting notes from the activated website copy.
- [ ] Set the effective date only when the completed terms are published.

The repository may publish this explicitly marked draft now. Publishing the draft is not evidence that the future service has completed legal review or implemented the controls described here.
