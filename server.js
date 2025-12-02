const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const RECIPES_FILE = path.join(__dirname, 'recipes.json');

// Middleware
app.use(express.json({ limit: '10mb' })); // Limit payload size for security
app.use(express.static('public'));

// Helper function to read recipes
async function readRecipes() {
  try {
    const data = await fs.readFile(RECIPES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty array
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// Helper function to write recipes
async function writeRecipes(recipes) {
  await fs.writeFile(RECIPES_FILE, JSON.stringify(recipes, null, 2), 'utf8');
}

// Sanitize input to prevent XSS
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Sanitize recipe object
function sanitizeRecipe(recipe) {
  const sanitized = {
    title: sanitizeInput(recipe.title),
    ingredients: recipe.ingredients.map(item => sanitizeInput(item)),
    steps: recipe.steps.map(step => sanitizeInput(step)),
    prepTime: sanitizeInput(recipe.prepTime)
  };
  
  // Add optional fields if provided
  if (recipe.category) sanitized.category = sanitizeInput(recipe.category);
  if (recipe.difficulty) sanitized.difficulty = sanitizeInput(recipe.difficulty);
  if (recipe.servings) sanitized.servings = sanitizeInput(recipe.servings);
  
  return sanitized;
}

// GET /api/recipes - Get all recipes
app.get('/api/recipes', async (req, res) => {
  try {
    const recipes = await readRecipes();
    res.json(recipes);
  } catch (error) {
    console.error('Error reading recipes:', error);
    res.status(500).json({ error: 'Failed to read recipes' });
  }
});

// POST /api/recipes - Add a new recipe
app.post('/api/recipes', async (req, res) => {
  try {
    const { title, ingredients, steps, prepTime } = req.body;

    // Validate required fields
    if (!title || !ingredients || !steps || !prepTime) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, ingredients, steps, and prepTime are required' 
      });
    }

    // Validate types
    if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Title must be a non-empty string' });
    }

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Ingredients must be a non-empty array' });
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'Steps must be a non-empty array' });
    }

    if (isNaN(Number(prepTime)) || Number(prepTime) < 0) {
      return res.status(400).json({ error: 'Prep time must be a valid positive number' });
    }

    // Read existing recipes
    const recipes = await readRecipes();

    // Check for duplicate titles (optional as per PRD)
    const duplicate = recipes.find(r => r.title.toLowerCase() === title.toLowerCase().trim());
    if (duplicate) {
      return res.status(409).json({ error: 'A recipe with this title already exists' });
    }

    // Create new recipe
    const newRecipe = sanitizeRecipe({
      title: title.trim(),
      ingredients: ingredients.map(ing => ing.trim()).filter(ing => ing),
      steps: steps.map(step => step.trim()).filter(step => step),
      prepTime: String(prepTime)
    });

    // Add to recipes array
    recipes.push(newRecipe);

    // Write back to file
    await writeRecipes(recipes);

    res.status(201).json({ message: 'Recipe added successfully', recipe: newRecipe });
  } catch (error) {
    console.error('Error adding recipe:', error);
    res.status(500).json({ error: 'Failed to add recipe' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Recipe platform server running on http://localhost:${PORT}`);
});

