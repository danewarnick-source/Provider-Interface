-- PHASE B — apply only after the meal planner removal is deployed to main;
-- main's client page and staff workspace still query these tables until then.
-- Children before parents so no CASCADE is needed.
DROP TABLE IF EXISTS public.client_meal_actuals;
DROP TABLE IF EXISTS public.client_meals;
DROP TABLE IF EXISTS public.client_shopping_items;
DROP TABLE IF EXISTS public.client_recipe_ingredients;
DROP TABLE IF EXISTS public.client_recipes;
DROP TABLE IF EXISTS public.client_meal_plans;
DROP TABLE IF EXISTS public.client_meal_support;
DROP TABLE IF EXISTS public.client_nutrition_config;
DROP TABLE IF EXISTS public.org_shopping_library;
