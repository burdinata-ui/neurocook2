/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Camera, Upload, ChefHat, ChevronRight, ArrowLeft, Loader2, Utensils, Flame, Scale, Droplet, Wheat, X, Plus, RefreshCw, Edit2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnalysisResult, Recipe, generateRecipesFromIngredients, detectIngredients, RecommendationMode } from './services/geminiService';

type Screen = 'main' | 'results' | 'recipe';

export default function App() {
  const [screen, setScreen] = useState<Screen>('main');
  const [loading, setLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [editableIngredients, setEditableIngredients] = useState<string[]>([]);
  const [isModified, setIsModified] = useState(false);
  const [newIngredient, setNewIngredient] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>('fast');
  const [portionSize, setPortionSize] = useState<number>(100);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isCamera = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const base64 = await fileToBase64(file);
      const ingredients = await detectIngredients(base64, file.type);
      if (ingredients.length === 0) {
        throw new Error("Не удалось найти продукты на фото. Попробуйте сделать снимок четче или при другом освещении.");
      }
      setEditableIngredients(ingredients);
      setResult({ ingredients, recipes: [] });
      setIsModified(false);
      setScreen('results');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Произошла ошибка при чтении фото. Пожалуйста, попробуйте другое изображение.');
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const reset = () => {
    setScreen('main');
    setResult(null);
    setEditableIngredients([]);
    setIsModified(false);
    setNewIngredient('');
    setEditingIndex(null);
    setSelectedRecipe(null);
    setImagePreview(null);
    setError(null);
  };

  const handleAddIngredient = () => {
    if (newIngredient.trim()) {
      setEditableIngredients([...editableIngredients, newIngredient.trim()]);
      setNewIngredient('');
      setIsModified(true);
    }
  };

  const handleRemoveIngredient = (index: number) => {
    setEditableIngredients(editableIngredients.filter((_, i) => i !== index));
    setIsModified(true);
  };

  const startEditing = (index: number, value: string) => {
    setEditingIndex(index);
    setEditValue(value);
  };

  const saveEdit = () => {
    if (editingIndex !== null && editValue.trim()) {
      const newList = [...editableIngredients];
      const oldValue = newList[editingIndex];
      if (oldValue !== editValue.trim()) {
        newList[editingIndex] = editValue.trim();
        setEditableIngredients(newList);
        setIsModified(true);
      }
      setEditingIndex(null);
    }
  };

  const handleRegenerate = async () => {
    if (editableIngredients.length === 0) {
      return;
    }

    setIsRegenerating(true);
    setError(null);
    try {
      const newRecipes = await generateRecipesFromIngredients(editableIngredients, recommendationMode);
      if (newRecipes.length === 0) {
        throw new Error("Не удалось подобрать рецепты для этого набора продуктов. Попробуйте добавить что-нибудь еще.");
      }
      if (result) {
        setResult({
          ...result,
          ingredients: editableIngredients,
          recipes: newRecipes
        });
        setIsModified(false);
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось обновить список блюд. Пожалуйста, проверьте интернет и попробуйте снова.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-emerald-100">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2" onClick={reset} style={{ cursor: 'pointer' }}>
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-xl tracking-tight">НейроПовар</h1>
        </div>
        {screen !== 'main' && (
          <button 
            onClick={reset}
            className="text-xs font-bold text-stone-400 hover:text-stone-900 transition-colors uppercase tracking-widest"
          >
            Домой
          </button>
        )}
      </header>

      <main className="max-w-md mx-auto p-4 pb-24">
        <AnimatePresence mode="wait">
          {screen === 'main' && (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 py-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-extrabold text-stone-900 leading-tight">Что приготовим сегодня?</h2>
                <p className="text-stone-500">Сфотографируйте продукты, и AI предложит лучшие рецепты.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={loading}
                  className="group relative flex flex-col items-center justify-center p-8 bg-white border-2 border-stone-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-300 shadow-sm"
                >
                  <div className="bg-emerald-100 p-4 rounded-full group-hover:bg-emerald-200 transition-colors">
                    <Camera className="w-8 h-8 text-emerald-600" />
                  </div>
                  <span className="mt-4 font-semibold text-lg">Сделать фото</span>
                  <input
                    type="file"
                    ref={cameraInputRef}
                    onChange={(e) => handleImageUpload(e, true)}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                  />
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="group relative flex flex-col items-center justify-center p-8 bg-white border-2 border-stone-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-300 shadow-sm"
                >
                  <div className="bg-stone-100 p-4 rounded-full group-hover:bg-stone-200 transition-colors">
                    <Upload className="w-8 h-8 text-stone-600" />
                  </div>
                  <span className="mt-4 font-semibold text-lg">Загрузить из галереи</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </button>
              </div>

              {loading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-200 blur-2xl rounded-full animate-pulse" />
                    <Loader2 className="w-16 h-16 text-emerald-600 animate-spin relative" />
                  </div>
                  <h3 className="mt-8 text-2xl font-bold text-stone-900">Анализируем продукты...</h3>
                  <p className="mt-2 text-stone-500 max-w-[250px]">Наш AI шеф-повар подбирает лучшие рецепты специально для вас.</p>
                </motion.div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-50 border border-red-200 p-6 rounded-3xl space-y-4"
                >
                  <div className="flex items-center gap-3 text-red-700">
                    <div className="bg-red-100 p-2 rounded-full">
                      <Utensils className="w-5 h-5" />
                    </div>
                    <span className="font-bold">Упс! Что-то пошло не так</span>
                  </div>
                  <p className="text-red-600 text-sm leading-relaxed">
                    {error}
                  </p>
                  <button 
                    onClick={() => setError(null)}
                    className="w-full bg-red-100 text-red-700 py-3 rounded-2xl font-bold text-sm hover:bg-red-200 transition-colors"
                  >
                    Попробовать снова
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {screen === 'results' && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <button onClick={reset} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold">Результаты анализа</h2>
              </div>

              {imagePreview && (
                <div className="relative aspect-video rounded-3xl overflow-hidden shadow-lg border border-stone-200">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <section className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400">Продукты</h3>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase">Проверка</span>
                  </div>
                  <p className="text-xs text-stone-500 leading-tight">
                    Проверьте список: если что-то распознано неточно, вы можете удалить или добавить продукты вручную.
                  </p>
                </div>

                {editableIngredients.length === 0 && (
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
                    <p className="text-blue-700 text-sm font-medium">
                      Список продуктов пуст. Добавьте хотя бы один продукт, чтобы получить рекомендации.
                    </p>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                  {editableIngredients.map((ing, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white border border-stone-200 px-3 py-2 rounded-2xl text-sm font-bold text-stone-700 shadow-sm flex items-center gap-2 group"
                    >
                      {editingIndex === i ? (
                        <div className="flex items-center gap-1">
                          <input 
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            className="w-24 bg-stone-50 outline-none border-b border-emerald-500 px-1"
                          />
                          <button onClick={saveEdit} className="text-emerald-600">
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span onClick={() => startEditing(i, ing)} className="cursor-pointer hover:text-emerald-600 transition-colors">
                            {ing}
                          </span>
                          <button 
                            onClick={() => handleRemoveIngredient(i)}
                            className="text-stone-300 hover:text-red-500 transition-colors ml-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </motion.div>
                  ))}
                  
                  <div className="flex items-center gap-2 bg-stone-100 border border-dashed border-stone-300 px-3 py-1.5 rounded-2xl">
                    <input 
                      placeholder="Добавить..."
                      value={newIngredient}
                      onChange={(e) => setNewIngredient(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()}
                      className="bg-transparent outline-none text-sm w-20 font-medium"
                    />
                    <button onClick={handleAddIngredient} className="text-stone-500 hover:text-emerald-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400">Режим рекомендаций</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'fast', label: 'Быстро', icon: <RefreshCw className="w-3.5 h-3.5" /> },
                      { id: 'hearty', label: 'Сытно', icon: <Flame className="w-3.5 h-3.5" /> },
                      { id: 'light', label: 'Полегче', icon: <Droplet className="w-3.5 h-3.5" /> }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => {
                          setRecommendationMode(mode.id as RecommendationMode);
                          setIsModified(true);
                        }}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border-2 transition-all ${
                          recommendationMode === mode.id 
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                            : 'border-stone-100 bg-white text-stone-400 hover:border-stone-200'
                        }`}
                      >
                        <div className={`mb-1 ${recommendationMode === mode.id ? 'text-emerald-600' : 'text-stone-300'}`}>
                          {mode.icon}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tighter">{mode.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {isModified && result?.recipes.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-orange-50 border border-orange-100 p-3 rounded-2xl flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4 text-orange-600 animate-spin-slow" />
                    <p className="text-orange-700 text-xs font-bold">
                      Список изменен. Обновите рекомендации, чтобы пересчитать рецепты и КБЖУ.
                    </p>
                  </motion.div>
                )}

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-50 border border-red-200 p-4 rounded-2xl space-y-2"
                  >
                    <p className="text-red-600 text-sm font-medium leading-relaxed">
                      {error}
                    </p>
                  </motion.div>
                )}

                <button 
                  onClick={handleRegenerate}
                  disabled={isRegenerating || editableIngredients.length === 0}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-emerald-600 text-white py-4 rounded-3xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50"
                >
                  {isRegenerating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ChefHat className="w-5 h-5" />
                  )}
                  {result?.recipes.length === 0 ? 'Получить рецепты' : 'Обновить рекомендации'}
                </button>
              </section>

              {isRegenerating && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="fixed inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center"
                >
                  <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-stone-100 flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                    <h3 className="mt-4 text-xl font-bold text-stone-900">Пересчитываем...</h3>
                    <p className="mt-1 text-stone-500 text-sm">Обновляем рецепты и КБЖУ под ваш список.</p>
                  </div>
                </motion.div>
              )}

              {result?.recipes.length > 0 && (
                <section className="space-y-4 pt-6 border-t border-stone-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400">Предложенные рецепты</h3>
                    <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">
                      <span>Режим: {
                        recommendationMode === 'fast' ? 'Быстро' : 
                        recommendationMode === 'hearty' ? 'Сытно' : 'Полегче'
                      }</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {result.recipes.map((recipe, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="bg-white border border-stone-200 p-5 rounded-[32px] shadow-sm hover:shadow-md transition-all cursor-pointer group"
                        onClick={() => {
                          setSelectedRecipe(recipe);
                          setScreen('recipe');
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="font-bold text-lg group-hover:text-emerald-600 transition-colors">{recipe.name}</h4>
                            <p className="text-stone-500 text-xs italic leading-tight mb-2">
                              {recipe.whyItFits}
                            </p>
                            <p className="text-stone-400 text-[10px] line-clamp-1">
                              Используем: {recipe.ingredients.join(', ')}
                            </p>
                          </div>
                          <div className="bg-stone-50 p-2.5 rounded-2xl group-hover:bg-emerald-50 transition-colors">
                            <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-emerald-600" />
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold text-stone-400">
                          <div className="flex items-center gap-1.5 bg-orange-50 text-orange-600 px-2.5 py-1 rounded-lg">
                            <Flame className="w-3.5 h-3.5" />
                            <span>{recipe.nutritionPer100g.calories} ккал/100г</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-stone-50 text-stone-600 px-2.5 py-1 rounded-lg">
                            <Utensils className="w-3.5 h-3.5" />
                            <span>{recipe.ingredients.length} ингред.</span>
                          </div>
                          {recipe.missingIngredients.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg">
                              <span className="text-[10px]">+{recipe.missingIngredients.length} доп.</span>
                            </div>
                          )}
                          {recipe.isFallbackNutrition && (
                            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg">
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Приблиз.</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}

          {screen === 'recipe' && selectedRecipe && (
            <motion.div
              key="recipe"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setScreen('results')} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold">Рецепт</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-stone-900 leading-tight">{selectedRecipe.name}</h3>
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <p className="text-emerald-800 text-sm italic">
                      <span className="font-bold">Почему это блюдо?</span> {selectedRecipe.whyItFits}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-stone-400">Порция (г)</h4>
                    <div className="flex items-center gap-3">
                      {[100, 150, 200, 300].map(size => (
                        <button
                          key={size}
                          onClick={() => setPortionSize(size)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                            portionSize === size 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                          }`}
                        >
                          {size}г
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <input 
                      type="range"
                      min="50"
                      max="1000"
                      step="10"
                      value={portionSize}
                      onChange={(e) => setPortionSize(parseInt(e.target.value))}
                      className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <div className="flex justify-between mt-2 text-[10px] text-stone-400 font-bold uppercase">
                      <span>50г</span>
                      <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{portionSize}г</span>
                      <span>1000г</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 py-6 border-y border-stone-200">
                  {[
                    { label: 'Ккал', value: selectedRecipe.nutritionPer100g.calories, icon: <Flame className="w-5 h-5 text-orange-600" />, bg: 'bg-orange-100' },
                    { label: 'Белки', value: selectedRecipe.nutritionPer100g.protein, icon: <Scale className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-100' },
                    { label: 'Жиры', value: selectedRecipe.nutritionPer100g.fat, icon: <Droplet className="w-5 h-5 text-yellow-600" />, bg: 'bg-yellow-100' },
                    { label: 'Угл.', value: selectedRecipe.nutritionPer100g.carbs, icon: <Wheat className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-100' },
                  ].map((stat, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <div className={`${stat.bg} p-2 rounded-2xl`}>
                        {stat.icon}
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="font-black text-sm leading-none">
                          {Math.round(stat.value * (portionSize / 100))}
                        </span>
                        <span className="text-[9px] text-stone-400 font-bold uppercase mt-1">{stat.label}</span>
                      </div>
                      <span className="text-[8px] text-stone-300 font-medium">
                        {stat.value}/100г
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {selectedRecipe.isFallbackNutrition && (
                    <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl flex items-start gap-2">
                      <div className="mt-0.5">
                        <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <p className="text-[10px] text-amber-700 leading-tight font-medium">
                        <span className="font-bold">Внимание:</span> Данные КБЖУ рассчитаны на основе наиболее близких аналогов. Реальные значения могут отличаться.
                      </p>
                    </div>
                  )}
                  <p className="text-[10px] text-stone-400 italic leading-tight">
                    * Расчет на 100г готового блюда базируется на данных USDA и Open Food Facts. Итоговые значения зависят от точного веса ингредиентов и способа термической обработки.
                  </p>
                </div>
              </div>

              <section className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-stone-400">Ингредиенты</h4>
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase mb-2 block">У вас есть:</span>
                    <ul className="grid grid-cols-1 gap-2">
                      {selectedRecipe.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-stone-100 shadow-sm">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-stone-700 font-medium">{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {selectedRecipe.missingIngredients.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-blue-600 uppercase mb-2 block">Нужно добавить:</span>
                      <ul className="grid grid-cols-1 gap-2">
                        {selectedRecipe.missingIngredients.map((ing, i) => (
                          <li key={i} className="flex items-center gap-3 bg-blue-50/50 p-3 rounded-2xl border border-blue-100 border-dashed">
                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                            <span className="text-blue-700 font-medium">{ing}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-stone-400">Пошаговое приготовление</h4>
                <div className="space-y-6 relative before:absolute before:left-[15px] before:top-4 before:bottom-4 before:w-0.5 before:bg-stone-100">
                  {selectedRecipe.steps.map((step, i) => (
                    <div key={i} className="relative pl-10">
                      <div className="absolute left-0 top-0 w-8 h-8 bg-white border-2 border-emerald-500 rounded-full flex items-center justify-center z-10">
                        <span className="text-xs font-bold text-emerald-600">{i + 1}</span>
                      </div>
                      <p className="text-stone-700 leading-relaxed pt-1">{step}</p>
                    </div>
                  ))}
                </div>
              </section>

              <button
                onClick={reset}
                className="w-full bg-stone-900 text-white py-4 rounded-3xl font-bold text-lg hover:bg-stone-800 transition-colors shadow-lg"
              >
                Найти новые рецепты
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-stone-50 to-transparent pointer-events-none">
        <div className="max-w-md mx-auto flex justify-center">
          <div className="bg-white/80 backdrop-blur-md border border-stone-200 px-6 py-3 rounded-full shadow-xl pointer-events-auto flex items-center gap-2 text-stone-400 text-xs font-medium">
            <span>Powered by Gemini AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
