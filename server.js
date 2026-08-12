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
// AI DETECTION - SAPLING
// =====================================================

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

        const response = await fetch(
            "https://api.sapling.ai/api/v1/aidetect",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    key: process.env.SAPLING_API_KEY,
                    text: text,
                    sent_scores: false
                })
            }
        );

        const data = await response.json();

        console.log("Sapling response:", data);

        if (!response.ok) {

            return res.status(response.status).json({
                error: "Sapling detection failed",
                details: data
            });
        }

        return res.json({
            success: true,
            score: data.score
        });

    } catch (error) {

        console.error("Detection error:", error);

        return res.status(500).json({
            success: false,
            error: "AI detection failed"
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