export interface GreetingData {
  greeting: string;
  subtext: string;
}

export function getGreeting(userName: string): GreetingData {
  const hour = new Date().getHours();
  const day = new Date().getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  
  // 70% chance for time-based, 30% for day-based
  const useTimeBased = Math.random() < 0.7;
  
  if (useTimeBased) {
    // TIME-BASED GREETINGS
    if (hour >= 5 && hour < 11) {
      return {
        greeting: `Good morning, ${userName}`,
        subtext: "Let's make today count"
      };
    }
    
    if (hour >= 11 && hour < 14) {
      return {
        greeting: `Hope you had a great morning, ${userName}`,
        subtext: "Ready to tackle the afternoon?"
      };
    }
    
    if (hour >= 14 && hour < 17) {
      return {
        greeting: `Good afternoon, ${userName}`,
        subtext: "Hope you're having a productive day"
      };
    }
    
    if (hour >= 17 && hour < 20) {
      return {
        greeting: `Good evening, ${userName}`,
        subtext: "Winding down or powering through?"
      };
    }
    
    // 8pm - 5am
    return {
      greeting: `Burning the midnight oil, ${userName}?`,
      subtext: "Take breaks when you need them"
    };
  } else {
    // DAY-BASED GREETINGS
    switch (day) {
      case 1: // Monday
        return {
          greeting: `Happy Monday, ${userName}!`,
          subtext: "Let's start the week strong"
        };
      
      case 2: // Tuesday
        return {
          greeting: `Happy Tuesday, ${userName}`,
          subtext: "Let's keep the momentum going"
        };
      
      case 3: // Wednesday
        return {
          greeting: `Halfway there, ${userName} 🎉`,
          subtext: "You're doing great"
        };
      
      case 4: // Thursday
        return {
          greeting: `Almost Friday, ${userName} 😉`,
          subtext: "Hang in there - you've got this"
        };
      
      case 5: // Friday
        return {
          greeting: `Happy Friday, ${userName}!`,
          subtext: "Weekend vibes incoming"
        };
      
      case 0: // Sunday
      case 6: // Saturday
        return {
          greeting: `Hope you're having a relaxing weekend, ${userName}`,
          subtext: "Enjoy your time off"
        };
      
      default:
        return {
          greeting: `Hello, ${userName}`,
          subtext: "Welcome back to your dashboard"
        };
    }
  }
}