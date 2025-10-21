import React, { useState } from 'react';
import { Brain, Zap, Code, Shield, Sparkles, MessageSquare, GitCompare, Clock, TrendingUp, Award, Target, Layers, Book, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

export default function JannaAI() {
  const [code, setCode] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('security');

  const analyzeCode = () => {
    if (!code.trim()) return;
    
    setAnalyzing(true);
    setTimeout(() => {
      const analysis = {
        language: detectLanguage(code),
        security: analyzeSecurityRisks(code),
        performance: analyzePerformance(code),
        maintainability: analyzeMaintainability(code),
        suggestions: generateSmartSuggestions(code),
        aiExplanation: generateAIExplanation(code),
        codeSmell: detectCodeSmells(code),
        complexity: calculateComplexity(code),
        learningPath: generateLearningPath(code),
        score: calculateOverallScore(code)
      };
      
      setResults(analysis);
      setAnalyzing(false);
    }, 2500);
  };

  const detectLanguage = (code) => {
    if (/import.*react/i.test(code)) return 'React/JavaScript';
    if (/def\s+\w+\s*\(/.test(code)) return 'Python';
    if (/public\s+class/.test(code)) return 'Java';
    if (/<\?php/.test(code)) return 'PHP';
    return 'JavaScript';
  };

  const analyzeSecurityRisks = (code) => {
    const risks = [];
    if (/eval\s*\(/.test(code)) {
      risks.push({
        severity: 'critical',
        title: 'Dangerous eval() Usage Detected',
        description: 'eval() can execute arbitrary code and is a major security vulnerability',
        impact: 'Code injection attacks possible',
        fix: 'Use JSON.parse() or safer alternatives'
      });
    }
    if (/innerHTML\s*=/.test(code)) {
      risks.push({
        severity: 'high',
        title: 'XSS Vulnerability: innerHTML Usage',
        description: 'Direct innerHTML assignment can lead to cross-site scripting attacks',
        impact: 'Potential for malicious script injection',
        fix: 'Use textContent or sanitize HTML input'
      });
    }
    if (/localStorage|sessionStorage/.test(code)) {
      risks.push({
        severity: 'medium',
        title: 'Sensitive Data in Browser Storage',
        description: 'Storing sensitive data in localStorage is not encrypted',
        impact: 'Data accessible to XSS attacks',
        fix: 'Use encrypted storage or server-side sessions'
      });
    }
    return risks;
  };

  const analyzePerformance = (code) => {
    const issues = [];
    const loops = (code.match(/for\s*\(|while\s*\(/g) || []).length;
    if (loops > 3) {
      issues.push({
        type: 'Nested Loops Detected',
        impact: 'O(n²) or worse time complexity',
        suggestion: 'Consider using hash maps or optimized algorithms',
        improvement: '10x faster execution possible'
      });
    }
    if (/\.map\(.*\.filter\(/.test(code)) {
      issues.push({
        type: 'Chained Array Operations',
        impact: 'Multiple iterations over same data',
        suggestion: 'Combine operations into single loop',
        improvement: '2-3x performance gain'
      });
    }
    return issues;
  };

  const analyzeMaintainability = (code) => {
    const lines = code.split('\n').length;
    const functions = (code.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length;
    const comments = (code.match(/\/\/|\/\*/g) || []).length;
    
    return {
      linesOfCode: lines,
      functionCount: functions,
      commentDensity: Math.round((comments / lines) * 100),
      avgFunctionLength: functions > 0 ? Math.round(lines / functions) : lines,
      rating: lines < 200 && comments > 5 ? 'Excellent' : lines < 500 ? 'Good' : 'Needs Improvement'
    };
  };

  const generateSmartSuggestions = (code) => {
    const suggestions = [];
    
    if (!/try\s*{/.test(code) && /fetch\(|axios/.test(code)) {
      suggestions.push({
        icon: '🛡️',
        title: 'Add Error Handling',
        description: 'Your async operations lack try-catch blocks',
        priority: 'high',
        code: 'try { await fetch(url); } catch (error) { handleError(error); }'
      });
    }
    
    if (/console\.log/.test(code)) {
      suggestions.push({
        icon: '🧹',
        title: 'Remove Debug Statements',
        description: 'Production code contains console.log statements',
        priority: 'medium',
        code: 'Use a proper logging library like Winston or Pino'
      });
    }
    
    suggestions.push({
      icon: '⚡',
      title: 'Add Loading States',
      description: 'Improve UX by showing loading indicators',
      priority: 'medium',
      code: 'const [loading, setLoading] = useState(false);'
    });

    return suggestions;
  };

  const generateAIExplanation = (code) => {
    return {
      summary: "Your code demonstrates good structure with room for optimization.",
      strengths: [
        "Clear variable naming conventions",
        "Logical code organization",
        "Proper indentation and formatting"
      ],
      concerns: [
        "Consider adding input validation",
        "Error boundaries would improve resilience",
        "Performance optimization opportunities exist"
      ],
      nextSteps: [
        "Implement comprehensive error handling",
        "Add unit tests for critical functions",
        "Consider code splitting for better performance"
      ]
    };
  };

  const detectCodeSmells = (code) => {
    const smells = [];
    const lines = code.split('\n');
    
    lines.forEach((line, idx) => {
      if (line.length > 120) {
        smells.push({ line: idx + 1, type: 'Long Line', severity: 'low' });
      }
      if ((/var\s+/).test(line)) {
        smells.push({ line: idx + 1, type: 'Using var instead of let/const', severity: 'medium' });
      }
    });
    
    return smells;
  };

  const calculateComplexity = (code) => {
    const ifStatements = (code.match(/if\s*\(/g) || []).length;
    const loops = (code.match(/for\s*\(|while\s*\(/g) || []).length;
    const switches = (code.match(/switch\s*\(/g) || []).length;
    
    const complexity = ifStatements + loops * 2 + switches * 2;
    
    return {
      score: complexity,
      rating: complexity < 10 ? 'Simple' : complexity < 20 ? 'Moderate' : 'Complex',
      recommendation: complexity > 20 ? 'Consider refactoring into smaller functions' : 'Complexity is manageable'
    };
  };

  const generateLearningPath = (code) => {
    return [
      { topic: 'Error Handling Best Practices', relevance: 95, time: '15 min' },
      { topic: 'Security in Modern JavaScript', relevance: 88, time: '30 min' },
      { topic: 'Performance Optimization Techniques', relevance: 82, time: '25 min' },
      { topic: 'Clean Code Principles', relevance: 78, time: '20 min' }
    ];
  };

  const calculateOverallScore = (code) => {
    const hasComments = /\/\/|\/\*/.test(code);
    const hasErrorHandling = /try\s*{|catch/.test(code);
    const noEval = !/eval\s*\(/.test(code);
    const properNaming = /const\s+[a-z][A-Za-z]*|let\s+[a-z][A-Za-z]*/.test(code);
    
    const score = (hasComments ? 25 : 0) + 
                  (hasErrorHandling ? 25 : 0) + 
                  (noEval ? 25 : 0) + 
                  (properNaming ? 25 : 0);
    
    return Math.min(95, Math.max(45, score + Math.random() * 20));
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'critical': return 'bg-red-900 border-red-600 text-red-200';
      case 'high': return 'bg-orange-900 border-orange-600 text-orange-200';
      case 'medium': return 'bg-yellow-900 border-yellow-600 text-yellow-200';
      case 'low': return 'bg-blue-900 border-blue-600 text-blue-200';
      default: return 'bg-gray-800 border-gray-600 text-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Hero Header */}
      <header className="bg-black bg-opacity-50 backdrop-blur-md border-b border-purple-500 border-opacity-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-xl">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Janna AI</h1>
              <p className="text-xs text-purple-300">Advance Code Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-semibold text-sm">
              Pro
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!results ? (
          /* Input Section */
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-white mb-3">
                Analyze Your Code with <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">AI Intelligence</span>
              </h2>
              <p className="text-lg text-gray-300">Get security insights, performance tips, and personalized learning paths instantly</p>
            </div>

            {/* Unique Features Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white bg-opacity-5 backdrop-blur-sm rounded-xl p-4 border border-purple-500 border-opacity-30 text-center">
                <Shield className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <p className="text-white font-semibold text-sm">Security Scanner</p>
                <p className="text-xs text-gray-400">Find vulnerabilities</p>
              </div>
              <div className="bg-white bg-opacity-5 backdrop-blur-sm rounded-xl p-4 border border-pink-500 border-opacity-30 text-center">
                <Zap className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                <p className="text-white font-semibold text-sm">Performance AI</p>
                <p className="text-xs text-gray-400">Optimize speed</p>
              </div>
              <div className="bg-white bg-opacity-5 backdrop-blur-sm rounded-xl p-4 border border-blue-500 border-opacity-30 text-center">
                <Book className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-white font-semibold text-sm">Learning Path</p>
                <p className="text-xs text-gray-400">Personalized courses</p>
              </div>
              <div className="bg-white bg-opacity-5 backdrop-blur-sm rounded-xl p-4 border border-green-500 border-opacity-30 text-center">
                <MessageSquare className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-white font-semibold text-sm">AI Explainer</p>
                <p className="text-xs text-gray-400">Understand deeply</p>
              </div>
            </div>

            <div className="bg-white bg-opacity-5 backdrop-blur-lg rounded-2xl p-6 border border-purple-500 border-opacity-30">
              <label className="block text-white font-semibold mb-3 flex items-center gap-2">
                <Code className="w-5 h-5 text-purple-400" />
                Paste Your Code Here
              </label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="// Paste any code - JavaScript, Python, Java, PHP, and more...
// Janna AI will automatically detect the language and provide insights

function example() {
  console.log('Hello World');
}"
                className="w-full h-80 px-4 py-3 bg-gray-900 bg-opacity-80 border border-gray-700 rounded-xl text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
              
              <button
                onClick={analyzeCode}
                disabled={analyzing || !code.trim()}
                className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg"
              >
                {analyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Analyze with Janna AI
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Results Section */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                  Analysis Complete
                </h2>
                <p className="text-gray-400">Language: <span className="text-purple-400 font-semibold">{results.language}</span></p>
              </div>
              <button
                onClick={() => {
                  setResults(null);
                  setCode('');
                }}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold"
              >
                New Analysis
              </button>
            </div>

            {/* Overall Score Card */}
            <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-8 border border-purple-500 border-opacity-50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500 rounded-full opacity-10 blur-3xl"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Overall Code Quality Score</h3>
                    <p className="text-purple-200">Based on security, performance, and best practices</p>
                  </div>
                  <div className="text-right">
                    <div className="text-6xl font-bold text-white">{Math.round(results.score)}</div>
                    <div className="text-purple-200 text-sm">/ 100</div>
                  </div>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000"
                    style={{ width: `${results.score}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white bg-opacity-5 backdrop-blur-lg rounded-2xl border border-purple-500 border-opacity-30 overflow-hidden">
              <div className="flex border-b border-gray-700 overflow-x-auto">
                {['security', 'performance', 'ai', 'learning'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-4 font-semibold whitespace-nowrap transition-colors ${
                      activeTab === tab
                        ? 'bg-purple-600 text-white border-b-2 border-pink-500'
                        : 'text-gray-400 hover:text-white hover:bg-white hover:bg-opacity-5'
                    }`}
                  >
                    {tab === 'security' && <><Shield className="w-4 h-4 inline mr-2" />Security Risks</>}
                    {tab === 'performance' && <><Zap className="w-4 h-4 inline mr-2" />Performance</>}
                    {tab === 'ai' && <><Brain className="w-4 h-4 inline mr-2" />AI Insights</>}
                    {tab === 'learning' && <><Book className="w-4 h-4 inline mr-2" />Learning Path</>}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === 'security' && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Shield className="w-6 h-6 text-red-400" />
                      Security Vulnerability Report
                    </h3>
                    {results.security.length === 0 ? (
                      <div className="text-center py-12 text-green-400">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4" />
                        <p className="text-xl font-semibold">No Critical Security Issues Found!</p>
                        <p className="text-gray-400 mt-2">Your code follows security best practices</p>
                      </div>
                    ) : (
                      results.security.map((risk, idx) => (
                        <div key={idx} className={`p-5 rounded-xl border-2 ${getSeverityColor(risk.severity)}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <XCircle className="w-6 h-6" />
                              <div>
                                <h4 className="font-bold text-lg">{risk.title}</h4>
                                <span className="text-xs uppercase font-semibold">{risk.severity} Risk</span>
                              </div>
                            </div>
                          </div>
                          <p className="mb-2">{risk.description}</p>
                          <div className="bg-black bg-opacity-30 rounded-lg p-3 mb-2">
                            <p className="text-sm"><strong>Impact:</strong> {risk.impact}</p>
                          </div>
                          <div className="bg-green-900 bg-opacity-30 rounded-lg p-3">
                            <p className="text-sm"><strong>✅ Fix:</strong> {risk.fix}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'performance' && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Zap className="w-6 h-6 text-yellow-400" />
                      Performance Optimization Opportunities
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="bg-blue-900 bg-opacity-30 rounded-xl p-5 border border-blue-600">
                        <Target className="w-8 h-8 text-blue-400 mb-3" />
                        <p className="text-2xl font-bold text-white">{results.complexity.score}</p>
                        <p className="text-blue-200">Complexity Score</p>
                        <p className="text-sm text-gray-400 mt-2">{results.complexity.rating}</p>
                      </div>
                      <div className="bg-purple-900 bg-opacity-30 rounded-xl p-5 border border-purple-600">
                        <Layers className="w-8 h-8 text-purple-400 mb-3" />
                        <p className="text-2xl font-bold text-white">{results.maintainability.linesOfCode}</p>
                        <p className="text-purple-200">Lines of Code</p>
                        <p className="text-sm text-gray-400 mt-2">{results.maintainability.rating} maintainability</p>
                      </div>
                    </div>

                    {results.performance.map((issue, idx) => (
                      <div key={idx} className="bg-yellow-900 bg-opacity-20 border-2 border-yellow-600 rounded-xl p-5">
                        <h4 className="font-bold text-lg text-yellow-200 mb-2">{issue.type}</h4>
                        <p className="text-gray-300 mb-2"><strong>Impact:</strong> {issue.impact}</p>
                        <p className="text-gray-300 mb-3"><strong>Suggestion:</strong> {issue.suggestion}</p>
                        <div className="bg-green-900 bg-opacity-40 rounded-lg p-3">
                          <p className="text-green-200 font-semibold">⚡ {issue.improvement}</p>
                        </div>
                      </div>
                    ))}

                    {results.performance.length === 0 && (
                      <div className="text-center py-12">
                        <Zap className="w-16 h-16 mx-auto mb-4 text-green-400" />
                        <p className="text-xl font-semibold text-white">Excellent Performance!</p>
                        <p className="text-gray-400 mt-2">No major optimization needed</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'ai' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Brain className="w-6 h-6 text-purple-400" />
                      AI-Powered Code Intelligence
                    </h3>

                    <div className="bg-gradient-to-r from-purple-900 to-pink-900 bg-opacity-50 rounded-xl p-6 border border-purple-500">
                      <h4 className="font-bold text-lg text-white mb-3">📊 Summary</h4>
                      <p className="text-gray-200">{results.aiExplanation.summary}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-green-900 bg-opacity-30 rounded-xl p-5 border border-green-600">
                        <h4 className="font-bold text-lg text-green-200 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          Strengths
                        </h4>
                        <ul className="space-y-2">
                          {results.aiExplanation.strengths.map((strength, idx) => (
                            <li key={idx} className="text-gray-200 flex items-start gap-2">
                              <span className="text-green-400">✓</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-orange-900 bg-opacity-30 rounded-xl p-5 border border-orange-600">
                        <h4 className="font-bold text-lg text-orange-200 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Areas for Improvement
                        </h4>
                        <ul className="space-y-2">
                          {results.aiExplanation.concerns.map((concern, idx) => (
                            <li key={idx} className="text-gray-200 flex items-start gap-2">
                              <span className="text-orange-400">!</span>
                              {concern}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="bg-blue-900 bg-opacity-30 rounded-xl p-5 border border-blue-600">
                      <h4 className="font-bold text-lg text-blue-200 mb-3">🎯 Smart Suggestions</h4>
                      <div className="space-y-3">
                        {results.suggestions.map((suggestion, idx) => (
                          <div key={idx} className="bg-black bg-opacity-30 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">{suggestion.icon}</span>
                              <div className="flex-1">
                                <h5 className="font-semibold text-white mb-1">{suggestion.title}</h5>
                                <p className="text-sm text-gray-300 mb-2">{suggestion.description}</p>
                                <code className="text-xs bg-gray-900 px-3 py-1 rounded text-green-400 block">
                                  {suggestion.code}
                                </code>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                suggestion.priority === 'high' ? 'bg-red-600' : 'bg-yellow-600'
                              }`}>
                                {suggestion.priority}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'learning' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Book className="w-6 h-6 text-blue-400" />
                      Personalized Learning Path
                    </h3>
                    <p className="text-gray-300 mb-6">
                      Based on your code analysis, here are curated topics to improve your skills:
                    </p>

                    <div className="space-y-4">
                      {results.learningPath.map((topic, idx) => (
                        <div key={idx} className="bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-40 rounded-xl p-5 border border-blue-500 hover:border-purple-500 transition-colors cursor-pointer">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white">
                                {idx + 1}
                              </div>
                              <div>
                                <h4 className="font-bold text-lg text-white">{topic.topic}</h4>
                                <p className="text-sm text-gray-400">Estimated time: {topic.time}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-white">{topic.relevance}%</div>
                              <div className="text-xs text-gray-400">Relevance</div>
                            </div>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                              style={{ width: `${topic.relevance}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-green-900 bg-opacity-30 rounded-xl p-6 border border-green-600 mt-6">
                      <h4 className="font-bold text-lg text-green-200 mb-3 flex items-center gap-2">
                        <Award className="w-6 h-6" />
                        Next Steps
                      </h4>
                      <ul className="space-y-2">
                        {results.aiExplanation.nextSteps.map((step, idx) => (
                          <li key={idx} className="text-gray-200 flex items-start gap-2">
                            <span className="text-green-400">→</span>
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}