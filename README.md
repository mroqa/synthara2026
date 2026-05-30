## 🔮 Synthara RPG Upgrades

Synthara has been upgraded from a minimal prototype into a rich, immersive, memory-driven dark fantasy narrative RPG. The application integrates advanced LLM orchestration (Gemini), vector storage (Qdrant), and real-time state management (Firestore).

### 🚀 Key Features

1. **Interactive Choose-Your-Own-Adventure Quests**
   * Quests are no longer resolved with a single click. Embarking on a quest launches a **3-stage interactive adventure**:
     * **Stage 0 (Opening):** The Gemini Oracle generates a custom atmospheric narrative scenario based on the player's history and displays 3 choices requiring different attributes.
     * **Stage 1 (Midpoint crisis):** Evaluates the player's choice against their effective stats (base + equipment), narrates the outcome, and presents a new crisis with 3 choices.
     * **Stage 2 (Climax):** The final stand resolves the quest. Overall success depends on the outcomes of both decisions.
   * Modals feature real-time success probability indicator bars, click hover animations, and location-derived scene banners.

2. **Rich Inventory & Equipment System**
   * Added an **Inventory Grid** on the profile page where players can inspect discovered items.
   * Includes a registry of 10 unique dark fantasy weapons, accessories, and artifacts (e.g. *Blade of Ruin*, *Mira's Ley Compass*, *Malachar's Stolen Seal*) with specific passives (e.g., `+6 Strength`, `+20 Max HP`).
   * Clicking an item opens a detailed drawer to **Equip/Unequip** items on the fly, dynamically updating effective stats and saving changes instantly to Firestore.

3. **Memory-Driven NPC Relationships & Crossroads Locking**
   * **The Black Citadel** is locked on the World Map until the player has logged at least **3 episodic memories** in their Qdrant vector database.
   * Features a locked map location overlay, custom tooltips, an in-viewport progress tracker, and disabled action buttons to create a narrative gating system.
   * NPC greetings dynamically analyze past memories via Qdrant semantic search to tailor dialogues based on past choices, quest successes, or refusals.

4. **Dynamic Dark Fantasy Location Banners**
   * Implemented 5 high-fidelity dark fantasy scene banners representing key locations:
     * *Thornwood Crossroads* (Misty dying forest)
     * *Vel'Drath Library* (Gothic cavern library with glowing tomes)
     * *Ashfeld Ruins* (Skeletal battlefield under lightning skies)
     * *The Veil Market* (Soul-lantern illuminated bazaar)
     * *The Black Citadel* (Obsidian fortress)
   * The banners automatically adjust to the active location and display with beautiful gradient overlays at the top of the main viewport and adventure modals.

---

### 🛠️ Technical Architecture & Resiliency

* **Advanced LLM Parsing:** Built a custom regex-backed `extractJSON` parsing system that guarantees fault-tolerant extraction of JSON objects from Gemini responses even when code fences or explanation text are returned.
* **Production AI Fallbacks:** Integrated safe local scenario fallbacks for all three stages in the resolve engine. If the Gemini API experiences network limits or returns unexpected responses, the game continues seamlessly.
* **Offline Mock Mode:** Engineered a dual-mode database engine that automatically transitions to browser local storage if Firebase credentials or connections are unavailable, keeping local development robust.
* **Production Build Verified:** The codebase has been fully verified and compiles cleanly without warnings using Next.js 16, React 19, and TypeScript.
