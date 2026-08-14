const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());

// =====================================================
// TEST ROUTE
// =====================================================

app.get("/", (req, res) => {
    res.json({
        message: "HumanizeX backend is running",
        status: "OK"
    });
});

// =====================================================
// AI DETECTION - MISTRAL AGENT
// =====================================================

async function detectWithMistral(text) {

    console.log("---------------------------------");
    console.log("Executing Mistral Detection Agent...");
    console.log("---------------------------------");

    if (!process.env.MISTRAL_API_KEY || !process.env.MISTRAL_DETECT_AGENT_ID) {
        const err = new Error("MISTRAL_API_KEY or MISTRAL_DETECT_AGENT_ID is not configured in Environment Variables.");
        err.code = "CONFIG_ERROR";
        throw err;
    }

    const response = await fetch(
        "https://api.mistral.ai/v1/agents/completions",
        {
            method: "POST",

            headers: {
                "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                agent_id: process.env.MISTRAL_DETECT_AGENT_ID,
                messages: [
                    {
                        role: "user",
                        content: text
                    }
                ]
            })
        }
    );

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error(
            `Mistral returned invalid JSON response. HTTP ${response.status}`
        );
    }

    console.log("Mistral detect HTTP status:", response.status);
    console.log("Mistral detect response:", data);

    if (!response.ok) {

        const error = new Error(
            data.message || data.error?.message || `Mistral API error: HTTP ${response.status}`
        );

        error.code = response.status === 429
            ? "QUOTA_EXHAUSTED"
            : "API_ERROR";

        error.details = data;

        throw error;
    }

    const replyText = data.choices?.[0]?.message?.content;

    if (!replyText || typeof replyText !== "string") {

        const error = new Error(
            "Mistral detection agent returned no text content"
        );

        error.code = "EMPTY_RESULT";
        error.details = data;

        throw error;
    }

    // ---------------------------------------------
    // PARSE THE AGENT'S REPLY
    // The agent replies with a structured JSON object like:
    // {
    //   "ai_percentage": 86.5,
    //   "confidence": "medium",
    //   "category": "ai_generated",
    //   "segment_analysis": [...],
    //   ...
    // }
    // sometimes wrapped in ```json ... ``` code fences, and
    // possibly with stray text before/after. We extract the
    // {...} block, JSON.parse it, and read ai_percentage
    // directly — rather than grabbing "the first number we
    // see", which breaks the moment the JSON field order
    // changes or the model adds a preamble.
    // ---------------------------------------------

    let percentage = null;

    const jsonMatch = replyText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {

        try {

            const parsed = JSON.parse(jsonMatch[0]);

            if (typeof parsed.ai_percentage === "number") {
                percentage = parsed.ai_percentage;
            }

        } catch (jsonError) {
            console.warn("HumanizeX: agent reply looked like JSON but failed to parse:", jsonError.message);
        }
    }

    // ---------------------------------------------
    // FALLBACK: agent didn't return valid/expected JSON —
    // try to salvage a percentage from raw text as a last resort.
    // ---------------------------------------------

    if (percentage === null) {

        const fallbackMatch = replyText.match(/"?ai_percentage"?\s*:?\s*(\d{1,3}(?:\.\d+)?)/)
            || replyText.match(/(\d{1,3}(?:\.\d+)?)\s*%/);

        if (fallbackMatch) {
            percentage = parseFloat(fallbackMatch[1]);
        }
    }

    if (percentage === null || Number.isNaN(percentage)) {

        const error = new Error(
            `Couldn't find ai_percentage in the agent's reply: "${replyText.slice(0, 200)}"`
        );

        error.code = "UNPARSEABLE_RESULT";
        error.details = { replyText };

        throw error;
    }

    // Clamp to 0-100 in case the agent replies with something odd
    percentage = Math.max(0, Math.min(100, percentage));

    // Convert to a 0.0-1.0 score to match the shape the
    // extension already expects
    return percentage / 100;
}

app.post("/api/detect", async (req, res) => {

    try {

        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                error: "No text provided"
            });
        }

        console.log("=================================");
        console.log("AI DETECTION REQUEST");
        console.log("=================================");

        const score = await detectWithMistral(text);

        return res.json({
            success: true,
            score
        });

    } catch (error) {

        console.error("Detection error:", error.message);

        if (error.details) {
            console.error("Details:", error.details);
        }

        return res.status(500).json({
            success: false,
            error: error.message || "AI detection failed"
        });
    }
});

// =====================================================
// MISTRAL AGENT HUMANIZER
// =====================================================

async function humanizeWithMistral(text) {

    console.log("---------------------------------");
    console.log("Executing Mistral Agent...");
    console.log("---------------------------------");

    if (!process.env.MISTRAL_API_KEY || !process.env.MISTRAL_AGENT_ID) {
        const err = new Error("MISTRAL_API_KEY or MISTRAL_AGENT_ID is not configured in Environment Variables.");
        err.code = "CONFIG_ERROR";
        throw err;
    }

    const response = await fetch(
        "https://api.mistral.ai/v1/agents/completions",
        {
            method: "POST",

            headers: {
                "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                agent_id: process.env.MISTRAL_AGENT_ID,
                messages: [
                    {
                        role: "user",
                        content: text
                    }
                ]
            })
        }
    );

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error(
            `Mistral returned invalid JSON response. HTTP ${response.status}`
        );
    }

    console.log("Mistral HTTP status:", response.status);

    // ---------------------------------------------
    // API ERROR HANDLING
    // ---------------------------------------------

    if (!response.ok) {
        console.error("Mistral API error data:", data);

        const error = new Error(
            data.message || data.error?.message || `Mistral API error: HTTP ${response.status}`
        );

        error.code = response.status === 429
            ? "QUOTA_EXHAUSTED"
            : "API_ERROR";

        error.details = data;

        throw error;
    }

    // ---------------------------------------------
    // EXTRACT TEXT
    // ---------------------------------------------

    const humanizedText = data.choices?.[0]?.message?.content;

    if (
        !humanizedText ||
        typeof humanizedText !== "string" ||
        !humanizedText.trim()
    ) {

        const error = new Error(
            "Mistral returned no humanized text content"
        );

        error.code = "EMPTY_RESULT";
        error.details = data;

        throw error;
    }

    // ---------------------------------------------
    // SUCCESS RETURN
    // ---------------------------------------------

    return {
        provider: "Mistral Agent",

        original: text,

        humanized: humanizedText.trim(),

        humanScore: null,

        grammarScore: null,

        simplicityScore: null,

        stylingScore: null,

        remainingUses: null,

        resetTime: null,

        wordCount: text.split(/\s+/).filter(Boolean).length
    };
}

// =====================================================
// HUMANIZE ROUTE
// =====================================================

app.post("/api/humanize", async (req, res) => {

    try {

        const { text } = req.body;

        // ---------------------------------------------
        // VALIDATION
        // ---------------------------------------------

        if (!text || typeof text !== "string") {

            return res.status(400).json({
                success: false,
                error: "Text is required"
            });
        }

        const cleanText = text.trim();

        if (!cleanText) {

            return res.status(400).json({
                success: false,
                error: "Text cannot be empty"
            });
        }

        console.log("");
        console.log("=================================");
        console.log("HUMANIZE REQUEST");
        console.log("=================================");
        console.log("Characters:", cleanText.length);
        console.log(
            "Words:",
            cleanText.split(/\s+/).filter(Boolean).length
        );

        // ---------------------------------------------
        // DIRECT CALL TO MISTRAL
        // ---------------------------------------------

        const result = await humanizeWithMistral(cleanText);

        // ---------------------------------------------
        // RETURN RESULT
        // ---------------------------------------------

        return res.json({
            success: true,

            provider: result.provider,

            original: result.original,

            humanized: result.humanized,

            metrics: {
                humanScore: result.humanScore,
                grammarScore: result.grammarScore,
                simplicityScore: result.simplicityScore,
                stylingScore: result.stylingScore
            },

            quota: {
                remainingUses: result.remainingUses,
                resetTime: result.resetTime
            },

            wordCount: result.wordCount
        });

    } catch (error) {

        console.error("");
        console.error("=================================");
        console.error("HUMANIZATION FAILED");
        console.error("=================================");
        console.error("Message:", error.message);

        if (error.details) {
            console.error("Details:", error.details);
        }

        return res.status(500).json({

            success: false,

            error: "Humanization failed",

            message: error.message || "Failed to process text with Mistral Agent."
        });
    }
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log("");
    console.log("=================================");
    console.log("      HUMANIZEX BACKEND");
    console.log("=================================");
    console.log(`Server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
    console.log("");
});