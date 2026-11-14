# Mika
- **seed:** How do I ask the installed house assistant for help?
- **when:** service:mika
- **depth:** seed
- **serves:**
- **order:** 80

Reach for this capability when the installed house assistant should answer or carry a
bounded request. Ronin Services is the installation that supplies Mika; it is not itself
an Agent capability. Installation state and component configuration remain Machine
Settings facts.

**Live tool:** `mika` starts or reaches the constrained house assistant.

Mika's house guidance limits how she uses the shared Machine settings tool. The tool does
not identify or reject her; the launcher does not change its write behavior.
