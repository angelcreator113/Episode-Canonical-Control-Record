const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const db = require('../models');

/**
 * Generate Lala-style script from formula
 * POST /api/v1/episodes/:episodeId/generate-lala-script
 */
router.post('/:episodeId/generate-lala-script', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { formula } = req.body;
    
    // Save formula first
    await db.LalaEpisodeFormula.upsert({
      episode_id: episodeId,
      opening_ritual: {
        lala_line: "Bestie, come style me — I'm ready for a new slay. Logging in…",
        emotional_vibe: formula.emotional_vibe
      },
      interruption: {
        type: formula.interruption_type,
        content: formula.interruption_content
      },
      reveal: {
        event_theme: formula.event_theme,
        why_it_matters: formula.why_it_matters
      },
      intention: {
        identity_stepping_into: formula.identity_stepping_into
      },
      transformation: {
        outfit_vibe: formula.outfit_vibe,
        accessory_vibe: formula.accessory_vibe,
        shoe_energy: formula.shoe_energy,
        final_touch: formula.final_touch
      },
      payoff: {
        what_this_look_makes_you_feel: formula.what_this_look_makes_you_feel
      },
      invitation: {
        audience_action: formula.audience_action
      },
      cliffhanger: {
        tease_for_next: formula.next_tease
      }
    });
    
    // Generate script using the formula
    const script = generateLalaScript(formula);
    
    // Calculate metadata
    const metadata = {
      estimated_duration: 720, // 12 minutes (10-14 range)
      scene_count: 11, // Fixed beat count
      emotional_arc: formula.emotional_vibe,
      format: 'lala_styling_adventure'
    };
    
    res.json({
      success: true,
      data: {
        script,
        metadata,
        formula_saved: true
      }
    });

  } catch (error) {
    console.error('Failed to generate Lala script:', error);
    res.status(500).json({ error: 'Failed to generate script' });
  }
});

/**
 * Generate the actual script text
 */
function generateLalaScript(formula) {
  return `
STYLING ADVENTURES WITH LALA
Episode Script (Generated)

EMOTIONAL VIBE: ${formula.emotional_vibe}
TARGET DURATION: 10-14 minutes

═══════════════════════════════════════════════════════════

[BEAT 1: STREAM OPEN] (1-2 min)
LAYOUT: Twitch-style
MUSIC: Instrumental (low, continuous)
UI: Coins • Mail • To-Do • Bestie News

[LALA appears on screen, scrolling phone, humming]

YOU (host):
"Hey besties! Welcome back to Styling Adventures. Last time, we [quick recap]. Today... today's a ${formula.emotional_vibe} kind of day. I'm feeling it. Let's see what the universe has for us."

[Lala stays in idle animation - no plot yet]

═══════════════════════════════════════════════════════════

[BEAT 2: INCITING MOMENT] (1 min)
LAYOUT: Twitch-style
MUSIC: Instrumental continues

[${formula.interruption_type.toUpperCase()} NOTIFICATION pops up]

YOU:
"Wait... what's this?"

[Reads aloud]:
"${formula.interruption_content}"

[React live - surprise/curiosity/excitement]

EVENT ESTABLISHED: ${formula.event_theme}
STAKES: ${formula.why_it_matters}

[Micro-Goals activate on screen]
✓ Personal
✓ Friendship  
✓ Career

═══════════════════════════════════════════════════════════

[BEAT 3: TO-DO LIST + STYLING INTENT] (1 min)
LAYOUT: Twitch-style
MUSIC: Instrumental continues

YOU:
"Okay besties, let's break this down. This isn't about perfection - it's about the energy. The vibe we're going for is ${formula.identity_stepping_into}."

[To-Do list appears on screen]

"For this ${formula.event_theme}, we need to think about who we're becoming in this moment. Not just what we're wearing."

OUTFIT RULES (displayed subtly):
- OWNED items (safe zone)
- GIFTED items (light pressure)  
- BRAND items (high stakes)

═══════════════════════════════════════════════════════════

[BEAT 4: STYLING GAMEPLAY] (3-4 min)
LAYOUT: Twitch-style  
MUSIC: Instrumental continues
PLAYER CONTROL: FULL

[For each styling choice, closet opens]

YOU:
"Alright, the outfit vibe needs to be ${formula.outfit_vibe}. What are we thinking?"

[Present 2-3 options]
[Lala reacts to each]

OWNED → Safe, encouraging
GIFTED → Slight pressure
BRAND → High stakes

"Besties, what do you think? Comment below!"

[Continue through]:
- Main outfit
- Accessories: ${formula.accessory_vibe}
- Shoes: ${formula.shoe_energy}  
- Final touch: ${formula.final_touch}

═══════════════════════════════════════════════════════════

[BEAT 5: CASH-GRAB QUEST] (30-60 sec) [OPTIONAL]
LAYOUT: Twitch-style
MUSIC: Instrumental continues

[Pop-up appears]

QUEST OPTION:
"Answer 10 comments in the next 15 minutes for 500 coins"

YOU:
"Hmm... do we take this? What do you think, besties?"

[Player chooses: Accept / Reject / Ask for Extension]

[If accepted: Time skip animation, coins update]

═══════════════════════════════════════════════════════════

[BEAT 6: FINAL CHECK + HANDOFF] (1 min)
LAYOUT: Twitch-style transitioning to cinematic
MUSIC: Instrumental begins to fade

YOU:
"Okay, let's recap. We've got the ${formula.outfit_vibe}, the ${formula.shoe_energy}, and this ${formula.final_touch} that just... ties it all together."

[Address camera directly]

"Alright besties... I think we're ready. Let's see how this plays out."

[LOCK-IN MOMENT]
[UI softens]
[Player loses control]

MUSIC: Fades slightly

═══════════════════════════════════════════════════════════

[BEAT 7: EVENT MODE - NO PAUSES] (2-3 min)
LAYOUT: Cinematic
MUSIC: Instrumental (louder, cinematic)
LALA: AUTONOMOUS
PLAYER CONTROL: NONE

[Lala navigates the ${formula.event_theme}]

[Friend archetypes appear]:
- THE BELIEVER (supportive)
- THE GROUNDER (realistic check)
- THE INSTIGATOR (creates tension)
- THE OPPORTUNIST (ulterior motive)

[Lala handles moments with poise]

[Bestie News pop-ups may appear in corner]

NO DIALOGUE - JUST VISUALS + MUSIC

═══════════════════════════════════════════════════════════

[BEAT 8: OUTCOME SUMMARY] (30 sec)
LAYOUT: Cinematic
MUSIC: Instrumental softens

[Subtle on-screen updates]:
Coins: +250
Reputation: Elevated
Relationships: 2 strengthened, 1 tested
Brand Interest: High

[No celebration unless earned]

═══════════════════════════════════════════════════════════

[BEAT 9: SCREENPLAY MOMENT - THE REWARD] (45-60 sec)
LAYOUT: FULL CINEMATIC
MUSIC: ✨ VOCALS VERSION OF LALA'S SONG ✨

[Photoshoot montage / Travel reflection / Quiet emotion]

NO DIALOGUE
NO UI
JUST VISUALS + MUSIC

[The feeling this creates]: ${formula.what_this_look_makes_you_feel}

═══════════════════════════════════════════════════════════

[BEAT 10: CLIFFHANGER / TAG] (30 sec)
LAYOUT: Twitch-style returns
MUSIC: Instrumental resumes briefly

[After vocals fade]

[New notification appears]

TEASE: ${formula.next_tease}

[Lala reacts]
[You react quietly]

CUT TO BLACK.

═══════════════════════════════════════════════════════════

[BEAT 11: END SCREEN] (30 sec)
LAYOUT: End card
MUSIC: Instrumental brief reprise

"Subscribe for the next adventure"
"Next episode: [Preview]"

═══════════════════════════════════════════════════════════

AUDIENCE CALL TO ACTION: ${formula.audience_action}

═══════════════════════════════════════════════════════════

END OF SCRIPT
Generated by Lala Formula Generator
This is an EPISODE, not a video.

`.trim();
}

module.exports = router;
