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
// HUMANIZER PROVIDER #1
// HUMANICER
// =====================================================

async function humanizeWithHumanicer(text) {

    console.log("---------------------------------");
    console.log("Trying Humanicer...");
    console.log("---------------------------------");

    const response = await fetch(
        "https://humanicer.com/v1/humanize/free",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                text: text
            })
        }
    );

    let data;

    try {
        data = await response.json();
    } catch (error) {

        throw new Error(
            `Humanicer returned invalid JSON. HTTP ${response.status}`
        );
    }

    console.log("Humanicer HTTP status:", response.status);
    console.log("Humanicer response:", data);

    // ---------------------------------------------
    // QUOTA EXHAUSTED
    // ---------------------------------------------

    if (
        response.status === 429 ||
        data.remaining_uses === 0
    ) {

        const error = new Error(
            "Humanicer free quota exhausted"
        );

        error.code = "QUOTA_EXHAUSTED";

        throw error;
    }

    // ---------------------------------------------
    // API ERROR
    // ---------------------------------------------

    if (!response.ok) {

        const error = new Error(
            `Humanicer API error: HTTP ${response.status}`
        );

        error.code = "API_ERROR";
        error.details = data;

        throw error;
    }

    // ---------------------------------------------
    // CHECK HUMANIZED TEXT
    // ---------------------------------------------

    if (
        !data.humanized_text ||
        typeof data.humanized_text !== "string" ||
        !data.humanized_text.trim()
    ) {

        const error = new Error(
            "Humanicer returned no humanized text"
        );

        error.code = "EMPTY_RESULT";
        error.details = data;

        throw error;
    }

    // ---------------------------------------------
    // SUCCESS
    // ---------------------------------------------

    return {
        provider: "Humanicer",

        original: text,

        humanized: data.humanized_text,

        humanScore: data.humanScore ?? null,

        grammarScore: data.grammarScore ?? null,

        simplicityScore: data.simplicityScore ?? null,

        stylingScore: data.stylingScore ?? null,

        remainingUses: data.remaining_uses ?? null,

        resetTime: data.reset_time ?? null,

        wordCount: data.word_count ?? null
    };
}

// =====================================================
// FUTURE PROVIDER #2
// =====================================================

async function humanizeWithProvider2(text) {

    /*
        We will add another REAL humanizer API here.

        Example:

        const response = await fetch(
            "PROVIDER_2_ENDPOINT",
            {
                method: "POST",
                headers: {
                    ...
                },
                body: JSON.stringify({
                    text: text
                })
            }
        );

        ...

    */

    const error = new Error(
        "Provider 2 is not configured yet"
    );

    error.code = "NOT_CONFIGURED";

    throw error;
}

// =====================================================
// FUTURE PROVIDER #3
// =====================================================

async function humanizeWithProvider3(text) {

    /*
        Another dedicated humanizer will go here.
    */

    const error = new Error(
        "Provider 3 is not configured yet"
    );

    error.code = "NOT_CONFIGURED";

    throw error;
}

// =====================================================
// HUMANIZER ROUTER
// =====================================================

async function humanizeText(text) {

    const providers = [

        {
            name: "Humanicer",
            function: humanizeWithHumanicer
        },

        {
            name: "Provider2",
            function: humanizeWithProvider2
        },

        {
            name: "Provider3",
            function: humanizeWithProvider3
        }

    ];

    const providerErrors = [];

    // ---------------------------------------------
    // TRY PROVIDERS ONE BY ONE
    // ---------------------------------------------

    for (const provider of providers) {

        try {

            console.log("");
            console.log("=================================");
            console.log("TRYING PROVIDER:", provider.name);
            console.log("=================================");

            const result = await provider.function(text);

            console.log("");
            console.log("SUCCESS");
            console.log("Provider:", provider.name);
            console.log("");

            return result;

        } catch (error) {

            console.log("");
            console.log(
                `Provider ${provider.name} failed:`,
                error.message
            );

            providerErrors.push({
                provider: provider.name,
                error: error.message,
                code: error.code || "UNKNOWN"
            });

            // Continue to next provider
            continue;
        }
    }

    // ---------------------------------------------
    // ALL PROVIDERS FAILED
    // ---------------------------------------------

    const error = new Error(
        "All humanizer providers failed"
    );

    error.providers = providerErrors;

    throw error;
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
            cleanText.split(/\s+/).length
        );

        // ---------------------------------------------
        // SEND TO HUMANIZER ROUTER
        // ---------------------------------------------

        const result = await humanizeText(cleanText);

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
        console.error("ALL HUMANIZERS FAILED");
        console.error("=================================");
        console.error(error.message);

        if (error.providers) {

            console.error(
                "Provider errors:",
                error.providers
            );
        }

        return res.status(503).json({

            success: false,

            error: "Humanization failed",

            message:
                "All available humanizer providers are currently unavailable.",

            providers: error.providers || []
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