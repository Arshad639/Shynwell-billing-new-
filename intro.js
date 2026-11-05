(function(){var d=document.documentElement,el=document.getElementById('intro');if(!el||!d.classList.contains('intro-on'))return;
var done=false,t1,waitTap=false,v=el.querySelector('video');
function fin(fast){if(done)return;done=true;clearTimeout(t1);if(fast)el.classList.add('fast');el.classList.add('out');d.classList.remove('intro-on');d.classList.add('intro-done');
setTimeout(function(){el.style.display='none';},fast?330:600);}
function fallback(){if(done||el.classList.contains('vf'))return;el.classList.add('vf');try{v.pause()}catch(e){}clearTimeout(t1);t1=setTimeout(fin,2000);}
if(!v)fallback();
else{
try{v.muted=true;v.defaultMuted=true;v.src='intro.mp4';}catch(e){fallback();}
v.addEventListener('ended',function(){clearTimeout(t1);t1=setTimeout(fin,350);});
v.addEventListener('error',fallback);
v.addEventListener('playing',function(){waitTap=false;});
try{var pr=v.play();if(pr&&pr.catch)pr.catch(function(){waitTap=true;});}catch(e){waitTap=true;}
setTimeout(function(){if(!done&&!waitTap&&v.currentTime<0.05)fallback();},3500);
t1=setTimeout(fin,6600);
}
el.addEventListener('click',function(){
if(waitTap&&v&&!el.classList.contains('vf')){waitTap=false;el.style.animation='none';clearTimeout(t1);t1=setTimeout(fin,7000);try{var q=v.play();if(q&&q.catch)q.catch(fallback);}catch(e){fallback();}return;}
fin(true);});
addEventListener('keydown',function(e){if(!done&&(e.key==='Escape'||e.key==='Enter'||e.key===' '))fin(true)});
})();
