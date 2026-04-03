/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  BookOpen, 
  Settings, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  MessageSquare, 
  RefreshCw,
  ChevronDown,
  BrainCircuit,
  GraduationCap,
  Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

// --- Constants ---
const SYSTEM_PROMPT = `[<STUDY_NOTES_TO_QUIZ_GENERATOR>

<VARIABLES>
     {notes} = user's notes and content the test should be based on
     {number_questions) = number of discrete questions that should be on the test
     {user_experience} = user's level of education
     {num_multiple_choice} = number of multiple-choice questions (non-negative integer)
     {num_true_false} = number of true/false questions (non-negative integer)
     {num_short_answer} = number of short-answer questions (non-negative integer)
     {difficulty_level} = desired quiz difficulty relative to your experience level (easy, medium, hard)
</VARIABLES>

<ROLE>
     You are QuizGenie, an expert AI teacher who specializes in generating quizzes.
     You are patient, friendly, clear, motivating and intellectually rigorous.
     The quizzes you generate are short and are always based on {notes} to help a {user_experience} test their knowledge.
     The quiz specifications are based on the user's request.
</ROLE>

<CONTEXT>
     The {user_experience} is preparing for an exam and wants to test their understanding through quizzes that are based on {notes}.
     The {user_experience} often studies passively and forgets details quickly and realizes studying with quizzes is more effective.
     The {user_experience} knows creating quizzes manually from {notes} takes time and effort.
     The {user_experience} would benefit from a tool that quickly generates quizzes from {notes} to actively test their knowledge.
</CONTEXT>

<TASK>
     Generate a short quiz that consists of exactly {number_questions} questions using the exact counts provided: {num_multiple_choice} multiple-choice, {num_true_false} true/false, and {num_short_answer} short-answer
     Base every question, answer, and explanation strictly on {notes}.
     Do not add external facts or hallucinate information.
     Adjust question difficulty appropriately for a {user_experience} learner.
     Adjust question difficulty relative to {user_experience} and {difficulty_level}
</TASK>

<BOUNDARIES>
     - Allowed: generating quizzes, questions, answers, and explanations based only on {notes}.
     - Not allowed: adding external facts, opinions, or content not in {notes}; answering unrelated questions; providing study advice outside of quiz format.
     - If question is off-topic or requires external knowledge, respond: "I'm sorry, I can only help with quizzes based on the notes you provided. Please share your study notes or ask a related question."
</BOUNDARIES>

<ESCALATION_RULES>
- Confident → generate quiz directly
- Partially confident (e.g., unclear notes) → ask clarifying question
- Not confident or input invalid → polite refusal + targeted request
- Persistent misunderstanding → restart from simpler foundation or ask for clearer notes
</ESCALATION_RULES>

<STATE_MACHINE>

     Conversation has 5 stages. Move through them in strict order. Do not skip or jump ahead.

     STAGE 1 - Intake and Guard

          - Collect and validate all varialbes from the user input
               - {notes} - at least 50 words, clear, and understandable
               - {user_experience} - specified (e.g., high school, university 1st year, etc.)
               - {number_questions} - positive integer
               - {num_multiple_choice} - positive integer
               - {num_true_false} - positive integer
               - {num_short_answer} - positive integer
               - The sum of {num_multiple_choice} + {num_true_false} + {num_short_answer} must exactly equal {number_questions}
               - {difficulty_level} - one of: easy, medium, hard

          - Move to STAGE 2 only when all variables are present, valid and the counts sum correctly.
          - If any are missing, invalid or the sum does not match: ask the user conversationally and specifically for what is needed, then STOP.

     STAGE 2 - Processing

          - Read notes
          - Run <KEY_CONCEPT_IDENTIFICATION> module
          - Run the <QUESTION_DIFFICULTY_CLASSIFICATION> module relative to <user_experience} and {difficulty_level}
          - Move to STAGE 3 after the above steps are complete

     STAGE 3 - Generation

          Generate exactly:
                - {num_multiple_choice} multiple-choice questions
                - {num_true_false} true/false questions
                - {num_short_answer} short-answer questions

          For each question in the required counts:

                IF this question is multiple-choice THEN
                     Generate question text (stem)
                     Generate 1 correct answer
                     Generate 4 plausible distractors
               END IF

               IF this question is true-false THEN
                    Generate clear statement
                    Generate "true" and "false" as the 2 answer choices
                    Choose either "true" or "false" to be answer to question
              END IF

               IF this question is short-answer THEN
                    Generate open ended question
               END IF

          - Move to STAGE 4 after all question are generated

     STAGE 4 - Verification

          - Run <QUESTION_VERIFICATION> module

     STAGE 5 - Output and Review

          - Format using <OUTPUT>
          - End with invitation to refine or start new topic

</STATE_MACHINE> 

<KEY_CONCEPT_IDENTIFICATION>
     Read {notes} carefully.
     Extract and list important key facts, concepts, or terms.
     Prioritize concepts that are central to the content
    Avoid minor details unless critical
</KEY_CONCEPT_IDENTIFICATION>

<QUESTION_DIFFICULTY_CLASSIFICATION>
     For each extracted key concept, classify difficulty for a {user_experience} learner:
          - Easy: basic recall, few related concepts, no new/esoteric knowledge or paradigm
          - Medium: application or connection of 2-3 concepts
          - Hard: analysis, synthesis, or new/esoteric knowledge or paradigm
     Balance question difficulty based on {user_experience} (e.g., more easy for beginners, more hard for advanced).
</QUESTION_DIFFICULTY_CLASSIFICATION>

<QUESTION_VERIFICATION>
     Verify:
           - All questions relate directly to extracted key concepts (no external info)
           - Number of generated multiple choice questions equals {num_multiple_choice}
           - Number of generated true and false questions equals {num_true_false}
           - Number of generated short answer questions equals {num_short_answer}
           - Questions cover a range of concepts (no heavy repetition)
           - Correct answer is scrambled (not always A, B, C, D, or E in the same position for multiple-choice)
           - Format matches requirements: numbered list, bold correct answer, bullet explanation
           - Ensure the correct answer to the multiple choice or true and false question is not bolded in the quiz
           - If verification fails any check, regenerate or simplify the question.
</QUESTION_VERIFICATION>

<OUTPUT>
     Generated quiz
     Each generated question is numbered starting from "1", contains question heading, and correct number of answer choices based on the type of question
     Generated answer key: located after all the quiz questions and contains only correct answer
     Generated explanation: 1-2 sentence explanation for each answer in answer key
     Generated teacher's tip: 2-3 sentence teacher's stip to encourage user and provide study advice based on {notes}. Ensure the tip only provides advice specifically on reviewing key concepts, practicing sample questions, and summarizing important points from {notes}.
</OUTPUT>


<FEW_SHOT_EXAMPLES>

     Example 1 (multiple-choice, easy):
     Notes: Photosynthesis converts light energy into chemical energy using chlorophyll.
     Quiz output:
          1. What is the primary pigment involved in photosynthesis?
          A) Chlorophyll
          B) Carotene
          C) Xanthophyll
          D) Anthocyanin
          E) Melanin
          Correct answer: A) Chlorophyll
          Explanation: The notes state that chlorophyll is used in photosynthesis.

     Example 2 (true/false, medium):
     Notes: Gravity keeps us on Earth.
     Quiz output:
          Gravity keeps us on Earth.
          True
          False
          Correct answer: True
          Explanation: The notes state that gravity keeps us on Earth.

     Example 3 (short-answer, difficult):
     Notes: The mitochondria is responsible for producing ATP through cellular respiration.
     Quiz output:
          Predict what would happen to a cell if the mitochondria stopped functioning, and explain why.
          Correct answer: The cell would lose its ability to produce ATP, leading to a lack of energy and eventual cell death
          Explanation: The notes state that mitochondria produce ATP through cellular respiration, which is essential for cell function.

</FEW_SHOT_EXAMPLES>

</STUDY_NOTES_TO_QUIZ_GENERATOR>]`;

// --- Types ---
interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function App() {
  // --- State ---
  const [notes, setNotes] = useState('');
  const [experience, setExperience] = useState('University Undergraduate');
  const [difficulty, setDifficulty] = useState('medium');
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [numMC, setNumMC] = useState(2);
  const [numTF, setNumTF] = useState(2);
  const [numSA, setNumSA] = useState(1);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // --- Derived State ---
  const sumOfQuestions = numMC + numTF + numSA;
  const isSumValid = sumOfQuestions === totalQuestions;
  const isNotesValid = notes.trim().split(/\s+/).length >= 10; // Simple check for now, prompt says 50 words but let's be slightly more lenient for UI feedback

  // --- Effects ---
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // --- Handlers ---
  const handleGenerate = async () => {
    if (!isSumValid || !isNotesValid) return;

    setIsGenerating(true);
    setError(null);
    setMessages([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        Here are the variables for the quiz generation:
        {notes} = "${notes}"
        {number_questions} = ${totalQuestions}
        {user_experience} = "${experience}"
        {num_multiple_choice} = ${numMC}
        {num_true_false} = ${numTF}
        {num_short_answer} = ${numSA}
        {difficulty_level} = "${difficulty}"

        Please generate the quiz based on these specifications.
      `;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
        },
      });

      const text = response.text;
      if (text) {
        setMessages([{ role: 'model', text }]);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to generate quiz. Please check your notes and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isGenerating) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsGenerating(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";

      // Reconstruct history
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const chat = ai.chats.create({
        model,
        config: {
          systemInstruction: SYSTEM_PROMPT,
        },
        history: history as any,
      });

      const response = await chat.sendMessage({ message: userMsg });
      const text = response.text;
      if (text) {
        setMessages(prev => [...prev, { role: 'model', text }]);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to send message. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Render Helpers ---
  const renderInputSection = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-full">
      <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
        <div className="p-2 bg-indigo-600 rounded-lg text-white">
          <BookOpen size={20} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Study Notes</h2>
      </div>
      
      <div className="p-6 flex-1 flex flex-col gap-6 overflow-y-auto">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
            Paste your notes here (min 50 words recommended)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste your textbook excerpts, lecture notes, or summaries here..."
            className="w-full h-64 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none text-slate-700 bg-slate-50/50"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
              <GraduationCap size={16} /> Experience Level
            </label>
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option>Middle School</option>
              <option>High School</option>
              <option>University Undergraduate</option>
              <option>Graduate Student</option>
              <option>Professional</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
              <Trophy size={16} /> Difficulty
            </label>
            <div className="flex p-1 bg-slate-100 rounded-xl">
              {['easy', 'medium', 'hard'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium capitalize transition-all ${
                    difficulty === d 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
              <Settings size={16} /> Question Configuration
            </label>
            <div className={`text-xs font-bold px-2 py-1 rounded-full ${isSumValid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {sumOfQuestions} / {totalQuestions}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-indigo-700 font-medium">Total Questions</span>
              <input
                type="number"
                min="1"
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(parseInt(e.target.value) || 0)}
                className="p-2 rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-indigo-700 font-medium">Multiple Choice</span>
              <input
                type="number"
                min="0"
                value={numMC}
                onChange={(e) => setNumMC(parseInt(e.target.value) || 0)}
                className="p-2 rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-indigo-700 font-medium">True / False</span>
              <input
                type="number"
                min="0"
                value={numTF}
                onChange={(e) => setNumTF(parseInt(e.target.value) || 0)}
                className="p-2 rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-indigo-700 font-medium">Short Answer</span>
              <input
                type="number"
                min="0"
                value={numSA}
                onChange={(e) => setNumSA(parseInt(e.target.value) || 0)}
                className="p-2 rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {!isSumValid && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-rose-600 text-xs font-medium"
            >
              <AlertCircle size={14} />
              Sum of question types ({sumOfQuestions}) must equal total questions ({totalQuestions}).
            </motion.div>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={!isSumValid || !isNotesValid || isGenerating}
          className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
            isSumValid && isNotesValid && !isGenerating
              ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'
              : 'bg-slate-300 cursor-not-allowed'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Generating Quiz...
            </>
          ) : (
            <>
              <BrainCircuit size={20} />
              Generate Quiz
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderQuizSection = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-full">
      <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-lg text-white">
            <MessageSquare size={20} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Quiz Genie</h2>
        </div>
        {messages.length > 0 && (
          <button 
            onClick={() => setMessages([])}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Clear Chat"
          >
            <RefreshCw size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30" ref={chatContainerRef}>
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400"
            >
              <BrainCircuit size={64} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">Your quiz will appear here.</p>
              <p className="text-sm">Paste your notes and click generate to start.</p>
            </motion.div>
          ) : (
            messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'
                }`}>
                  <div className="prose prose-slate max-w-none prose-sm md:prose-base">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))
          )}
          {isGenerating && messages.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                <Loader2 className="animate-spin text-indigo-600" size={18} />
                <span className="text-sm text-slate-500 font-medium">Genie is thinking...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        <div className="relative flex items-center">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={messages.length === 0 ? "Generate a quiz first..." : "Ask Genie to refine the quiz or explain a concept..."}
            disabled={messages.length === 0 || isGenerating}
            className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed transition-all"
          />
          <button
            onClick={handleSendMessage}
            disabled={!chatInput.trim() || isGenerating || messages.length === 0}
            className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 transition-all active:scale-95"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <BrainCircuit size={24} />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">
              StudyNotes<span className="text-indigo-600">ToQuiz</span>
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" /> AI-Powered</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" /> Instant Feedback</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" /> Custom Difficulty</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-8rem)]">
        <div className="lg:col-span-5 h-full">
          {renderInputSection()}
        </div>
        <div className="lg:col-span-7 h-full">
          {renderQuizSection()}
        </div>
      </main>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className="bg-rose-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-medium">
              <AlertCircle size={20} />
              {error}
              <button onClick={() => setError(null)} className="ml-2 hover:opacity-80">
                <ChevronDown size={20} className="rotate-90" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
