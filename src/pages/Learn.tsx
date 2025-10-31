import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Play, FileText, Trophy, Clock, Star, ChevronRight } from "lucide-react";

const Learn = () => {
  // NOTE: This data is for demonstration purposes only
  // In production, integrate with:
  // - Learning Management System (LMS) API
  // - Database (Supabase courses table)
  // - User progress tracking
  // - Real course content management system

  // DEMO DATA - Replace with database queries in production
  const courses = [
    {
      id: 1,
      title: "Forex Fundamentals",
      description: "Learn the basics of foreign exchange trading",
      difficulty: "Beginner",
      duration: "2 hours",
      progress: 0,
      lessons: 8,
      rating: 4.8,
      students: 1250,
      image: null
    },
    {
      id: 2,
      title: "Technical Analysis Masterclass",
      description: "Master chart patterns and technical indicators",
      difficulty: "Intermediate",
      duration: "4 hours",
      progress: 35,
      lessons: 12,
      rating: 4.9,
      students: 890,
      image: null
    },
    {
      id: 3,
      title: "Risk Management Strategies",
      description: "Learn to protect your capital and manage risk",
      difficulty: "Intermediate",
      duration: "3 hours",
      progress: 80,
      lessons: 10,
      rating: 4.7,
      students: 675,
      image: null
    },
    {
      id: 4,
      title: "Advanced Trading Psychology",
      description: "Develop the right mindset for successful trading",
      difficulty: "Advanced",
      duration: "5 hours",
      progress: 0,
      lessons: 15,
      rating: 4.6,
      students: 432,
      image: null
    }
  ];

  // DEMO DATA - Replace with user-specific achievements from database
  const achievements = [
    { title: "First Steps", description: "Complete your first lesson", earned: true },
    { title: "Knowledge Seeker", description: "Complete 5 courses", earned: true },
    { title: "Technical Expert", description: "Master technical analysis", earned: false },
    { title: "Risk Master", description: "Complete risk management course", earned: true },
    { title: "Trading Guru", description: "Complete all advanced courses", earned: false },
  ];

  // DEMO DATA - Replace with user's recent lesson history from database
  const recentLessons = [
    { title: "Understanding Currency Pairs", course: "Forex Fundamentals", completed: true },
    { title: "Support and Resistance Levels", course: "Technical Analysis", completed: true },
    { title: "Position Sizing Strategies", course: "Risk Management", completed: false },
    { title: "Candlestick Patterns", course: "Technical Analysis", completed: false },
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "Intermediate": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "Advanced": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Learning Center</h1>
          <p className="text-muted-foreground">Master forex trading with our comprehensive courses and tutorials</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="courses" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="courses">Courses</TabsTrigger>
                <TabsTrigger value="tutorials">Tutorials</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
              </TabsList>
              
              <TabsContent value="courses" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {courses.map((course) => (
                    <Card key={course.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-primary" />
                          </div>
                          <Badge className={getDifficultyColor(course.difficulty)}>
                            {course.difficulty}
                          </Badge>
                        </div>
                        
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                          {course.title}
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          {course.description}
                        </p>
                        
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{course.progress}%</span>
                          </div>
                          <Progress value={course.progress} className="h-2" />
                        </div>
                        
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{course.duration}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              <span>{course.lessons} lessons</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span>{course.rating}</span>
                          </div>
                        </div>
                        
                        <Button className="w-full">
                          {course.progress > 0 ? "Continue Learning" : "Start Course"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="tutorials">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <Play className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-xl font-semibold mb-2">Video Tutorials</h3>
                      <p className="text-muted-foreground mb-6">
                        Step-by-step video guides for all skill levels
                      </p>
                      <Button>Browse Tutorials</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="resources">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Trading Guides
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">
                        Comprehensive PDF guides covering all aspects of forex trading
                      </p>
                      <Button variant="outline" className="w-full">
                        Download Guides
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        Glossary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">
                        Learn trading terminology and key concepts
                      </p>
                      <Button variant="outline" className="w-full">
                        Browse Terms
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Learning Progress */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Your Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">47%</div>
                    <div className="text-sm text-muted-foreground">Overall Progress</div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Courses Completed</span>
                      <span className="font-medium">2/4</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Study Hours</span>
                      <span className="font-medium">12.5h</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Certificates Earned</span>
                      <span className="font-medium">1</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Lessons */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Continue Learning</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentLessons.map((lesson, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{lesson.title}</div>
                        <div className="text-xs text-muted-foreground">{lesson.course}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Achievements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {achievements.map((achievement, index) => (
                    <div key={index} className={`flex items-start gap-3 p-3 rounded-lg ${
                      achievement.earned 
                        ? "bg-primary/10 border border-primary/20" 
                        : "bg-muted/50"
                    }`}>
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        achievement.earned ? "bg-primary" : "bg-muted-foreground"
                      }`}></div>
                      <div className="flex-1">
                        <div className={`font-medium text-sm ${
                          achievement.earned ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          {achievement.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {achievement.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Learn;