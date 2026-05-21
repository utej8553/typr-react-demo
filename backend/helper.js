const axios = require("axios");

const FALLBACK_PARAGRAPHS = [
  "The quick brown fox jumps over the lazy dog. A quick movement of the enemy will jeopardize six gunboats. Pack my box with five dozen liquor jugs.",
  "Programming is not about what you know; it is about what you can figure out. The best error message is the one that never shows up because it was avoided.",
  "Web development is a fast-paced field where technology changes constantly. Modern frameworks like React, Next.js, and Node.js enable us to build beautiful, responsive applications.",
  "To be successful in software engineering, one must write clean, readable code and design systems that are simple, scalable, and easy to maintain over time.",
  "The keyboard click of a programmer in the middle of the night is the sound of creativity. Speed and accuracy are both critical for a high typing score."
];

async function generateParagraphAPI(wordCount) {
  try {
    const url = `https://random-word-api.herokuapp.com/word?number=${wordCount}`;
    const res = await axios.get(url, { timeout: 1500 }); // 1.5s timeout to prevent hanging

    if (Array.isArray(res.data)) {
      const paragraph = res.data.join(" ");
      console.log("Generated paragraph from API:", paragraph);
      return paragraph;
    } else {
      throw new Error("Unexpected API response format");
    }
  } catch (err) {
    console.warn("API paragraph generation failed/timed out. Using local fallback paragraph. Error:", err.message);
    const randomIndex = Math.floor(Math.random() * FALLBACK_PARAGRAPHS.length);
    return FALLBACK_PARAGRAPHS[randomIndex];
  }
}

module.exports = {
  generateParagraphAPI,
};
