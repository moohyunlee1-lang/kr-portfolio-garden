export class Practice {
  constructor(seconds=180) { this.reset(seconds); }
  reset(seconds=this.duration) {
    if(![60,180,300,600].includes(seconds)) throw new Error('Unsupported duration');
    this.duration=seconds;this.elapsed=0;this.since=null;this.count=0;this.completed=false;
  }
  get running() { return this.since!==null; }
  start(now) { if(!this.running && !this.completed) this.since=now; }
  pause(now) { if(this.running) {this.elapsed+=Math.max(0,now-this.since)/1000;this.since=null;} }
  remaining(now) { return Math.max(0,this.duration-this.elapsed-(this.running?Math.max(0,now-this.since)/1000:0)); }
  act() { if(!this.completed) this.count++; }
  finish(now) { if(this.completed || this.remaining(now)>0) return false;this.pause(now);this.completed=true;return true; }
}
