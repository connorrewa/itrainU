'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import GoogleSlides from '@/components/GoogleSlides';
import AvatarCircle from '@/components/AvatarCircle';
import MicrophoneButton from '@/components/MicrophoneButton';
import PresentationOverlay from '@/components/PresentationOverlay';
import axios from 'axios';

export default function TrainingPage() {
  const [lectures, setLectures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPresentationStarted, setIsPresentationStarted] = useState(false);
  const [isAvatarReady, setIsAvatarReady] = useState(true);
  const [isMicActive, setIsMicActive] = useState(false);
  const [currentScriptIndex, setCurrentScriptIndex] = useState(0);
  const [isWaitingForQuestion, setIsWaitingForQuestion] = useState(false);
  const [questionAttempts, setQuestionAttempts] = useState(0);
  const [isEndQuestioning, setIsEndQuestioning] = useState(false);
  const [currentEndQuestionIndex, setCurrentEndQuestionIndex] = useState(0);
  const [endQuestions, setEndQuestions] = useState([]);
  
  const avatarRef = useRef(null);
  const slidesRef = useRef(null);
  const timeoutRef = useRef(null);
  const params = useParams();
  const title = decodeURIComponent(params.title);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchLecture = async () => {
      try {
        const response = await fetch('/api/auth/getLecturesByTitle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });

        const data = await response.json();
        if (response.ok) {
          setLectures(data.lectures.map(lecture => ({
            title: lecture.title,
            scripts: lecture.scripts,
            presentationId: lecture.presentationId,
          })));
        }
      } catch (error) {
        console.error('Error fetching lecture:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (title) {
      fetchLecture();
    }
  }, [title]);

  const generateEndQuestions = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        throw new Error('Backend URL is not configured');
      }

      const allContent = lectures[0].scripts.join(' ');
      const response = await axios.post(`${backendUrl}/api/rag_chat`, {
        message: `Based on this content, generate 2 questions to test understanding. Format as a JSON array of objects with 'question' and 'expectedTopics' properties. The expectedTopics should be key concepts that should be mentioned in a good answer: ${allContent}`
      });

      const questions = JSON.parse(response.data.answer);
      setEndQuestions(questions);
      return questions;
    } catch (error) {
      console.error('Error generating end questions:', error);
      return [];
    }
  };

  const evaluateAnswer = async (answer, expectedTopics) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const response = await axios.post(`${backendUrl}/api/rag_chat`, {
        message: `Evaluate this answer. Expected topics: ${expectedTopics.join(', ')}. Answer: "${answer}". 
                 Respond with: 1) Whether the answer addresses the key topics (yes/no)
                 2) A brief, encouraging feedback comment.
                 Format as JSON with 'isGood' (boolean) and 'feedback' (string) properties.`
      });

      const evaluation = JSON.parse(response.data.answer);
      return evaluation;
    } catch (error) {
      console.error('Error evaluating answer:', error);
      return { isGood: true, feedback: "Thank you for your answer." };
    }
  };

  const handleEndQuestions = async () => {
    setIsEndQuestioning(true);
    setCurrentEndQuestionIndex(0);
    
    const questions = await generateEndQuestions();
    if (questions.length === 0) {
      await avatarRef.current.speak("Thank you for attending this presentation. Have a great day!");
      return;
    }

    await avatarRef.current.speak("Now that we've completed the presentation, I'd like to ask you a few questions to check your understanding.");
    await askNextEndQuestion(questions, 0);
  };

  const askNextEndQuestion = async (questions, index) => {
    if (index >= questions.length) {
      await avatarRef.current.speak("Thank you for your participation. You've completed all the questions. Have a great day!");
      return;
    }

    await avatarRef.current.speak(questions[index].question);
    setIsAvatarReady(true);
    setIsMicActive(true);
  };

  const moveToNextSlide = async () => {
    if (currentScriptIndex < lectures[0].scripts.length - 1) {
      setCurrentScriptIndex(prev => prev + 1);
      if (slidesRef.current) {
        slidesRef.current.goToNextSlide();
      }
      await readScript(currentScriptIndex + 1);
    } else if (!isEndQuestioning) {
      // We've reached the end of the presentation
      await handleEndQuestions();
    }
  };

  const analyzeResponse = async (transcript) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        throw new Error('Backend URL is not configured');
      }

      const response = await axios.post(`${backendUrl}/api/rag_chat`, {
        message: `Analyze if this response indicates the user has no questions or wants to move on. Response: "${transcript}". Reply with just "yes" if they want to move on or have no questions, "no" if they have a question or want to stay on the current slide.`
      });

      return response.data.answer.toLowerCase().includes('yes');
    } catch (error) {
      console.error('Error analyzing response:', error);
      return false;
    }
  };

  const waitForQuestion = async () => {
    setIsWaitingForQuestion(true);
    setIsAvatarReady(true);
    setIsMicActive(true);
    
    timeoutRef.current = setTimeout(async () => {
      if (isWaitingForQuestion) {
        setIsWaitingForQuestion(false);
        setIsMicActive(false);
        await moveToNextSlide();
      }
    }, 30000);
  };

  const readScript = async (index) => {
    if (!lectures[0]?.scripts?.[index]) return;
    
    setIsAvatarReady(false);
    setIsMicActive(false);
    setQuestionAttempts(0);
    
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      await avatarRef.current.speak(lectures[0].scripts[index]);
      await avatarRef.current.speak("Do you have any questions about this slide?");
      await waitForQuestion();
    } catch (error) {
      console.error('Error reading script:', error);
      setIsAvatarReady(true);
    }
  };

  const startPresentation = async () => {
    if (!lectures[0]?.scripts?.length) {
      console.error('No lecture scripts available');
      return;
    }

    setIsPresentationStarted(true);
    setCurrentScriptIndex(0);
    
    if (slidesRef.current) {
      slidesRef.current.startPresentation();
    }

    await readScript(0);
  };

  const handleMicrophoneClick = (isActive) => {
    setIsMicActive(isActive);
  };

  const handleSpeechResult = async (transcript) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    console.log('User said:', transcript);
    setIsWaitingForQuestion(false);
    setIsAvatarReady(false);
    
    try {
      if (isEndQuestioning) {
        const evaluation = await evaluateAnswer(transcript, endQuestions[currentEndQuestionIndex].expectedTopics);
        await avatarRef.current.speak(evaluation.feedback);
        
        // Move to next question or end
        setCurrentEndQuestionIndex(prev => prev + 1);
        if (currentEndQuestionIndex + 1 < endQuestions.length) {
          await askNextEndQuestion(endQuestions, currentEndQuestionIndex + 1);
        } else {
          await avatarRef.current.speak("That concludes our questions. Thank you for your participation!");
        }
        return;
      }

      // Handle navigation commands
      if (transcript.toLowerCase().includes('next slide')) {
        if (slidesRef.current) {
          slidesRef.current.goToNextSlide();
          setCurrentScriptIndex(prev => prev + 1);
        }
        await avatarRef.current.speak("Moving to the next slide.");
        await readScript(currentScriptIndex + 1);
        return;
      } 
      
      if (transcript.toLowerCase().includes('previous slide')) {
        if (slidesRef.current) {
          slidesRef.current.goToPreviousSlide();
          setCurrentScriptIndex(prev => Math.max(0, prev - 1));
        }
        await avatarRef.current.speak("Going back to the previous slide.");
        await readScript(currentScriptIndex - 1);
        return;
      }

      // Check if the response indicates no questions
      const hasNoQuestions = await analyzeResponse(transcript);
      if (hasNoQuestions) {
        await avatarRef.current.speak("Alright, let's continue.");
        await moveToNextSlide();
        return;
      }

      // Handle the question using RAG chat
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        throw new Error('Backend URL is not configured');
      }

      const response = await axios.post(`${backendUrl}/api/rag_chat`, {
        message: transcript
      });

      if (response.data && avatarRef.current) {
        await avatarRef.current.speak(response.data.answer);
        
        setQuestionAttempts(prev => prev + 1);
        if (questionAttempts < 2) {
          await avatarRef.current.speak("Do you have any other questions about this slide?");
          await waitForQuestion();
        } else {
          await avatarRef.current.speak("Let's move on to the next slide.");
          await moveToNextSlide();
        }
      } else {
        throw new Error('Invalid response from RAG chat');
      }

    } catch (error) {
      console.error('Error processing speech:', error);
      if (avatarRef.current) {
        let errorMessage = "I'm sorry, I didn't quite catch that. Could you please repeat your question?";
        if (error.response) {
          console.error('Error response:', error.response.data);
          errorMessage = "I'm having trouble understanding. Could you please rephrase your question?";
        }
        await avatarRef.current.speak(errorMessage);
        await waitForQuestion();
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark">{title}</h1>
        </div>

        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-8">
            {lectures.length > 0 ? (
              <div className="relative aspect-video bg-dark rounded-lg overflow-hidden">
                <GoogleSlides 
                  ref={slidesRef} 
                  presentationId={lectures[0].presentationId} 
                />
                {!isPresentationStarted && (
                  <PresentationOverlay onStart={startPresentation} />
                )}
              </div>
            ) : (
              <div>No lecture available.</div>
            )}
            
            <div className="flex flex-col justify-between h-full">
              <div className="flex items-center h-full">
                <AvatarCircle ref={avatarRef} />
              </div>
              <div className="flex justify-center">
                <MicrophoneButton 
                  isActive={isMicActive}
                  onClick={handleMicrophoneClick}
                  onSpeechResult={handleSpeechResult}
                  avatarReady={isAvatarReady}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}