export interface GreetingData {
  greeting: string;
  userName: string;
  subtext: string;
}

export function getGreeting(userName: string): GreetingData {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  
  const useTimeBased = Math.random() < 0.7;
  
  if (useTimeBased) {
    if (hour >= 5 && hour < 11) {
      return {
        greeting: "Good morning,",
        userName: userName,
        subtext: "Let's make today count"
      };
    }
    
    if (hour >= 11 && hour < 14) {
      return {
        greeting: "Hope you had a great morning,",
        userName: userName,
        subtext: "Ready to tackle the afternoon?"
      };
    }
    
    if (hour >= 14 && hour < 17) {
      return {
        greeting: "Good afternoon,",
        userName: userName,
        subtext: "Hope you're having a productive day"
      };
    }
    
    if (hour >= 17 && hour < 20) {
      return {
        greeting: "Good evening,",
        userName: userName,
        subtext: "Winding down or powering through?"
      };
    }
    
    return {
      greeting: "Burning the midnight oil,",
      userName: `${userName}?`,
      subtext: "Take breaks when you need them"
    };
  } else {
    switch (day) {
      case 1:
        return {
          greeting: "Happy Monday,",
          userName: `${userName}!`,
          subtext: "Let's start the week strong"
        };
      
      case 2:
        return {
          greeting: "Happy Tuesday,",
          userName: userName,
          subtext: "Let's keep the momentum going"
        };
      
      case 3:
        return {
          greeting: "Halfway there,",
          userName: `${userName} 🎉`,
          subtext: "You're doing great"
        };
      
      case 4:
        return {
          greeting: "Almost Friday,",
          userName: `${userName} 😉`,
          subtext: "Hang in there - you've got this"
        };
      
      case 5:
        return {
          greeting: "Happy Friday,",
          userName: `${userName}!`,
          subtext: "Weekend vibes incoming"
        };
      
      case 0:
      case 6:
        return {
          greeting: "Hope you're having a relaxing weekend,",
          userName: userName,
          subtext: "Enjoy your time off"
        };
      
      default:
        return {
          greeting: "Hello,",
          userName: userName,
          subtext: "Welcome back to your dashboard"
        };
    }
  }
}