/**
 * CultureBridge — Two taste streams.
 * A lightweight, original Three.js parametric woven-ribbon scene: A and B
 * visibly cross at a shared point. No generic rotating ball, no copied assets.
 * Runs only when WebGL is available; accessible UI never depends on animation.
 */
const stage=document.getElementById('scene-visual');
const canvas=document.getElementById('taste-canvas');
if(stage && canvas){
  const prefersReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!prefersReduced){
    try{
      const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.181.0/build/three.module.js');
      const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.35;
      renderer.setClearColor(0,0);
      const scene=new THREE.Scene();
      const camera=new THREE.PerspectiveCamera(40,1,.1,100);
      camera.position.set(0,.04,10);
      const root=new THREE.Group();
      scene.add(root);
      const aPalette=[new THREE.Color('#477b59'),new THREE.Color('#d6ff8b'),new THREE.Color('#eaffbf')];
      const bPalette=[new THREE.Color('#ad5063'),new THREE.Color('#ff93a8'),new THREE.Color('#ffe2c7')];
      const bezier=(t,a,b)=>a*(1-t)+b*t;
      function track(hand,t){
        const x=hand*(-2.55+5.10*t);
        const waviness=Math.sin(t*Math.PI);
        const y=(hand*.4)+waviness*Math.sin(t*2*Math.PI+(hand===1?0:Math.PI))*.95;
        const z=Math.cos(t*2*Math.PI+(hand===1?.65:2.05))*.85;
        return new THREE.Vector3(x,y,z);
      }
      function ribbon(hand,palette){
        const steps=210,across=12;
        const position=[],colors=[],indices=[];
        const sideBasis=new THREE.Vector3();
        const zAxis=new THREE.Vector3(0,0,1);
        const color=new THREE.Color();
        const p=new THREE.Vector3(),before=new THREE.Vector3(),after=new THREE.Vector3(),tangent=new THREE.Vector3();
        for(let i=0;i<=steps;i++){
          const t=i/steps;
          p.copy(track(hand,t));
          before.copy(track(hand,Math.max(0,t-.003)));
          after.copy(track(hand,Math.min(1,t+.003)));
          tangent.subVectors(after,before).normalize();
          sideBasis.crossVectors(tangent,zAxis).normalize();
          if(sideBasis.lengthSq()<.01)sideBasis.set(0,1,0);
          const front=new THREE.Vector3().crossVectors(tangent,sideBasis).normalize();
          const rotation=t*3.2*Math.PI + (hand===1?0:1.0);
          const turn=sideBasis.multiplyScalar(Math.cos(rotation)).add(front.multiplyScalar(Math.sin(rotation))).normalize();
          const width=.59*(.45+.55*Math.sin(Math.PI*t)**.7);
          let base;
          if(t<.52)base=color.copy(palette[0]).lerp(palette[1],t/.52);
          else base=color.copy(palette[1]).lerp(palette[2],(t-.52)/.48);
          for(let j=0;j<=across;j++){
            const v=j/across;
            const s=(v-.5)*2*width;
            const point=p.clone().addScaledVector(turn,s);
            position.push(point.x,point.y,point.z);
            const shade=.72+.28*Math.cos((v-.5)*Math.PI);
            colors.push(base.r*shade,base.g*shade,base.b*shade);
            if(i<steps&&j<across){
              const n=i*(across+1)+j;
              indices.push(n,n+across+1,n+1,n+1,n+across+1,n+across+2);
            }
          }
        }
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
        geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        const material=new THREE.MeshPhysicalMaterial({
          vertexColors:true,side:THREE.DoubleSide,metalness:.44,roughness:.23,
          clearcoat:1,clearcoatRoughness:.12,iridescence:.19,iridescenceIOR:1.45,
          emissive:hand===1?0x264624:0x47212e,emissiveIntensity:.20
        });
        const mesh=new THREE.Mesh(geometry,material);
        const strand=new THREE.Group();
        strand.add(mesh);
        // Slim glowing edge reinforces the shape without replacing the geometry.
        const edge=[];
        for(let i=0;i<=steps;i++)edge.push(track(hand,i/steps));
        const edgeCurve=new THREE.CatmullRomCurve3(edge);
        strand.add(new THREE.Mesh(
          new THREE.TubeGeometry(edgeCurve,steps,.018,6,false),
          new THREE.MeshBasicMaterial({color:hand===1?0xc4ff99:0xffa7ab,transparent:true,opacity:.64})
        ));
        return strand;
      }
      const a=ribbon(1,aPalette),b=ribbon(-1,bPalette);
      root.add(a,b);
      const core=new THREE.Group();
      const nucleus=new THREE.Mesh(
        new THREE.IcosahedronGeometry(.26,3),
        new THREE.MeshPhysicalMaterial({color:0xf6ffe4,metalness:.4,roughness:.12,clearcoat:1,iridescence:.25,emissive:0xb9ff94,emissiveIntensity:.48})
      );
      core.add(nucleus);
      for(let i=0;i<2;i++){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.6+i*.28,.012,8,140),
          new THREE.MeshBasicMaterial({color:i?0xffa8b9:0xbaff99,transparent:true,opacity:.5,depthWrite:false}));
        ring.rotation.set(i?.83:1.18,i?.6:-.32,.15);
        core.add(ring);
      }
      core.position.set(0,0,.7);
      root.add(core);
      const count=140,positions=new Float32Array(count*3);
      for(let i=0;i<count;i++){
        const u=(i*.6180339887)%1;
        const v=(i*.4142135624)%1;
        const theta=u*2*Math.PI;
        const radius=2.15+Math.sqrt(v)*2;
        positions[3*i]=Math.cos(theta)*radius;
        positions[3*i+1]=Math.sin(theta)*radius*.66;
        positions[3*i+2]=-1.7+Math.sin(i*3.22)*.6;
      }
      const stars=new THREE.BufferGeometry();
      stars.setAttribute('position',new THREE.BufferAttribute(positions,3));
      root.add(new THREE.Points(stars,
        new THREE.PointsMaterial({color:0xe8f5d9,size:.027,sizeAttenuation:true,transparent:true,opacity:.68,depthWrite:false})
      ));
      const ambient=new THREE.AmbientLight(0xffffff,2.0);
      scene.add(ambient);
      const key=new THREE.DirectionalLight(0xffffff,4.5);key.position.set(-3,5,6);scene.add(key);
      const fill=new THREE.DirectionalLight(0xff9da9,3.2);fill.position.set(4,-3,5);scene.add(fill);
      const rim=new THREE.DirectionalLight(0xd8ff8a,2.4);rim.position.set(-4,-1,-3);scene.add(rim);
      let isVisible=true,w=0,h=0;
      const size=()=>{
        const rect=stage.getBoundingClientRect();
        const nw=Math.max(1,Math.round(rect.width)),nh=Math.max(1,Math.round(rect.height));
        if(w===nw&&h===nh)return;w=nw;h=nh;
        renderer.setSize(w,h,false);
        camera.aspect=w/h;camera.position.z=w<350?12:10;
        camera.updateProjectionMatrix();
      };
      const resizeObserver=new ResizeObserver(size);resizeObserver.observe(stage);size();
      const observer=new IntersectionObserver(entries=>{isVisible=Boolean(entries[0]?.isIntersecting)},{threshold:.01});
      observer.observe(stage);
      let cursorX=0,cursorY=0;
      window.addEventListener('pointermove',e=>{
        if(e.pointerType==='touch')return;
        cursorX=(e.clientX/window.innerWidth-.5)*2;
        cursorY=(e.clientY/window.innerHeight-.5)*2;
      },{passive:true});
      let phase='empty-state',engagement=0,time=0,last=0,selectionStrength=0;
      const values={'empty-state':0,'match-review':.25,'loading-state':.9,'results':1,'error-state':0};
      document.addEventListener('culturebridge:phase',event=>{phase=event.detail?.phase||'empty-state';});
      document.addEventListener('culturebridge:selection',event=>{
        selectionStrength=Math.max(0,Math.min(1,Number(event.detail?.balance||0)/100));
      });
      function frame(now){
        requestAnimationFrame(frame);
        if(!isVisible||document.hidden)return;
        if(now-last<32)return;
        const dt=Math.min(.05,(now-(last||now))/1000);last=now;time+=dt;
        const target=values[phase]||0;
        engagement+=(target-engagement)*.043;
        a.position.x=-.18+engagement*.17;
        b.position.x=.18-engagement*.17;
        a.rotation.y=.07*Math.sin(time*.3)+cursorX*.04;
        b.rotation.y=-.07*Math.sin(time*.28)+cursorX*.03;
        root.rotation.y=.10*Math.sin(time*.16)+cursorX*.13;
        root.rotation.x=.05*Math.sin(time*.26)-cursorY*.09;
        root.position.y=.035*Math.sin(time*.72);
        core.rotation.y=time*.24;
        core.rotation.x=time*.12;
        core.scale.setScalar(1+engagement*.21+selectionStrength*.18+.04*Math.sin(time*.95));
        renderer.render(scene,camera);
      }
      requestAnimationFrame(frame);
      stage.classList.add('scene-ready');
    }catch(error){
      console.warn('CultureBridge optional 3D unavailable; showing accessible static connection artwork.');
    }
  }
}
