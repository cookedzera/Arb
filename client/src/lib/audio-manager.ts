// Global audio manager for seamless music across navigation
import audioFile from "@assets/upbeat-anime-background-music-285658_1755435962944.mp3";

export class AudioManager {
  private static instance: AudioManager;
  private audio: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  private volume: number = 0.12;
  
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }
  
  private constructor() {}
  
  init(): void {
    if (this.isInitialized) return; // Prevent re-initialization
    
    // Use the correct audio file path from attached assets
    this.audio = new Audio(audioFile);
    this.audio.volume = this.isMuted ? 0 : this.volume;
    this.audio.loop = true;
    this.isInitialized = true;
    
    console.log('AudioManager: Global audio instance initialized');
    this.startPlayback();
  }
  
  private async startPlayback(): Promise<void> {
    if (!this.audio) return;
    
    try {
      await this.audio.play();
      console.log('AudioManager: Playback started');
    } catch (error) {
      console.log('AudioManager: Auto-play blocked, waiting for user interaction');
      this.setupUserInteractionHandler();
    }
  }
  
  private setupUserInteractionHandler(): void {
    if (this.userInteractionHandlerSetup) return; // Prevent multiple handlers
    
    const handleInteraction = async () => {
      if (this.audio && this.audio.paused) {
        try {
          await this.audio.play();
          console.log('AudioManager: Playback started after user interaction');
        } catch (e) {
          console.error('AudioManager: Playback failed:', e);
        }
      }
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      this.userInteractionHandlerSetup = false;
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    this.userInteractionHandlerSetup = true;
  }
  
  private userInteractionHandlerSetup = false;
  
  toggleMute(): boolean {
    if (!this.audio) {
      console.warn('AudioManager: No audio instance available');
      return this.isMuted;
    }
    
    this.isMuted = !this.isMuted;
    this.audio.volume = this.isMuted ? 0 : this.volume;
    
    console.log(`AudioManager: ${this.isMuted ? 'Muted' : 'Unmuted'}, volume: ${this.audio.volume}`);
    return this.isMuted;
  }
  
  getMuted(): boolean {
    return this.isMuted;
  }
  
  // Don't cleanup on navigation - keep music playing
  destroy(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
      console.log('AudioManager: Audio destroyed');
    }
    this.isInitialized = false;
  }
}