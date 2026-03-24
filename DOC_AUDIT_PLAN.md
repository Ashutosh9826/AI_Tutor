<context>
Project: Academic Atelier (React/Vite Frontend, Node.js/Express Backend, Prisma ORM).
Goal: Perform a comprehensive codebase audit to synchronize, correct, and significantly enrich the existing `PROJECT_DOCUMENTATION.md` file.
</context>

<rules>
- Do not modify any `.js`, `.jsx`, or `.prisma` source code files during this operation. This is strictly a read-and-document task.
- Be highly specific. If you find a component, list its actual props. If you find an API route, list its required payload.
- Maintain the existing section structure of `PROJECT_DOCUMENTATION.md`, but expand upon it and add new sections if necessary.
</rules>

<execution-plan>

  <step id="1" name="Baseline Ingestion">
    <target-file>PROJECT_DOCUMENTATION.md</target-file>
    <instructions>
      - Read the current documentation to understand the established baseline and structure.
    </instructions>
  </step>

  <step id="2" name="Frontend Deep Scan">
    <target-directory>frontend/src/</target-directory>
    <instructions>
      - Scan all React components (`.jsx`) and routing files.
      - Identify any UI components, modals, or pages that exist in the code but are missing from "Section 4 — UI Blocks" or "Section 7 — Page Structure".
      - Document the exact props used by core reusable components.
      - Map out the exact state management approach (e.g., local state, context, or external stores) used for the Live Lesson View.
    </instructions>
  </step>

  <step id="3" name="Backend Deep Scan">
    <target-directory>backend/</target-directory>
    <instructions>
      - Scan `backend/routes/`, `backend/index.js`, and `backend/services/`.
      - Cross-reference the discovered API endpoints with the documentation. Add any missing routes, including expected request bodies and response structures.
      - Document the exact Socket.IO event names being emitted and listened to, ensuring "Section 3" is 100% accurate.
      - Review `schema.prisma` to ensure all database models and relationships are accurately described.
    </instructions>
  </step>

  <step id="4" name="Target Audience & Design System Integration">
    <target-file>PROJECT_DOCUMENTATION.md</target-file>
    <instructions>
      - Update "Section 1 — High Level Description" to explicitly document the platform's UI/UX design language. 
      - Note that the application utilizes a fun, adventurous, and lighthearted theme.
      - Specify that the visual style should be colorful and utilize a cartoon/comic book aesthetic tailored for a target age demographic of 5–8 years old. 
      - Ensure this context is noted so future contributors understand the intended user experience.
    </instructions>
  </step>

  <step id="5" name="Documentation Rewrite">
    <target-file>PROJECT_DOCUMENTATION.md</target-file>
    <instructions>
      - Overwrite the file with the newly enriched documentation.
      - Add a new section titled "Section 10 — Discovered Architecture Details" to highlight the most technical findings from your scan (e.g., specific middleware used, cron jobs if any, helper utilities).
    </instructions>
  </step>

</execution-plan>

<output-requirements>
After completing the rewrite, provide a brief summary in our chat of the top 3 biggest discrepancies or missing features you found between the code and the original documentation.
</output-requirements>