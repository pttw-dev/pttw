// ==UserScript==
// @name         pttw
// @namespace    https://github.com/pttw-dev/pttw
// @version      1.8
// @description  Добавляет новые функции в Pony Town
// @author       nekit270
// @match        http://*.pony.town/*
// @match        https://*.pony.town/*
// @icon         https://pony.town/favicon-32x32.png
// @grant        none
// ==/UserScript==

(function(){
    try{
        let w = (window.unsafeWindow?window.unsafeWindow:window);
        if(self != top) return;

        //[Глобальные переменные]

        //Короткие имена для функций DOM
        const qs = (s,e)=>(e??document).querySelector(s);
        const qsa = (s,e)=>(e??document).querySelectorAll(s);
        const ce = n=>document.createElement(n);

        let twOptions, twScripts, gl, ws, onstartmenuloaded, ongameloaded;

        function merge(target, source){
            for(let i in source){
                target[i] = source[i];
            }
            return target;
        }

        let firstTI2 = true;

        //Финт ушами, чтобы получать массив пикселей с экрана
        HTMLCanvasElement.prototype.realGC = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(c, o){
            if(!o) o = {};
            o.preserveDrawingBuffer = true;

            let ctx = this.realGC(c, o);

            if(c.includes('webgl')){
                gl = ctx;
                /*ctx.realTI2D = ctx.texImage2D;
            ctx.texImage2D = function(){
                firstTI2 = false;
                if(!firstTI2 && arguments[5] instanceof ImageData){
                    let c = document.createElement('canvas');
                    c.width = 1024;
                    c.height = 1024;
                    let cc = c.getContext('2d');
                    cc.fillStyle = 'limegreen';
                    cc.fillRect(0, 0, 1024, 1024);
                    arguments[5] = cc.getImageData(0, 0, 1024, 1024);
                }
                return this.realTI2D(...arguments);
            }*/
            }

            return ctx;
        }

        if(false){
            w.diList = [];
            CanvasRenderingContext2D.prototype.realDI = CanvasRenderingContext2D.prototype.drawImage;
            CanvasRenderingContext2D.prototype.drawImage = function(){
                let ret = this.realDI(...arguments);
                w.diList.push({ context: this, isWhatNeeded: this.canvas?.parentNode?.parentNode?.nodeName == 'BUILDING-BUTTON', name: this.canvas?.parentNode?.innerText, data: this.canvas.toDataURL() });
                return ret;
            }
        }

        const eventListeners = [];
        EventTarget.prototype.realAEL = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(t, l, o){
            eventListeners.push({event: t, listener: l, target: this, options: o, useCapture: o});
            this.realAEL(t, l, o);
        }

        function encryptName(name){
            return btoa(encodeURIComponent(navigator.appVersion + name + navigator.userAgent));
        }

        function decryptName(name){
            return decodeURIComponent(atob(name)).replace(navigator.appVersion, '').replace(navigator.userAgent, '');
        }

        function saveToLS(name, value){
            w.localStorage.setItem(encryptName(name), value);
        }

        function readFromLS(name){
            return w.localStorage.getItem(encryptName(name));
        }

        let randomString = {
            firstChars: 'abcdefghijklmnopqrstuvwxyz',
            storage: {},
            get(s){
                if(this.storage[s]) return this.storage[s];
                let uuid = this.firstChars[Math.floor(Math.random() * this.firstChars.length)] + crypto.randomUUID().replaceAll('-', '');
                this.storage[s] = uuid;
                return uuid;
            }
        }

        //[/Глобальные переменные]

        //[API]

        //Вспомогательные классы для API
        class Player{
            constructor(elem, name, status, tags, social){
                this.elem = elem;
                this.name = name;
                this.status = status;
                this.tags = tags;
                this.social = social;
            }
            isOpened(){
                return !!this.elem.parentNode;
            }
            close(){
                dispatchEvent(new KeyboardEvent('keydown', {keyCode: 27}));
            }
            action(act){
                let pb = this.elem, menu = qs('div.dropdown-menu', pb), toggle = qs('button.dropdown-toggle', pb);
                if(!menu){
                    toggle.click();
                    menu = qs('div.dropdown-menu', pb);
                }
                let ret = false;
                qsa('button.dropdown-item', pb).forEach(btn=>{
                    if(btn.innerText.toLowerCase().includes(act.toLowerCase())){
                        btn.click();
                        toggle.click();
                        ret = true;
                    }
                });
                return ret;
            }
            isActionAvailable(act){
                let pb = this.elem, menu = qs('div.dropdown-menu', pb), toggle = qs('button.dropdown-toggle', pb);
                if(!menu){
                    toggle.click();
                    menu = qs('div.dropdown-menu', pb);
                }
                let ret = false;
                qsa('button.dropdown-item', pb).forEach(btn=>{
                    if(btn.innerText.toLowerCase().includes(act.toLowerCase()) && !btn.disabled){
                        ret = true;
                    }
                });
                return ret;
            }
        }

        class Message{
            constructor(elem, type, time, author, text){
                this.elem = elem;
                this.type = type;
                this.time = time;
                this.author = author;
                this.text = text;
            }
            getPlayer(){
                return pt.player.getByMessage(this);
            }
            getSupporterLevel(){
                return (this.elem.className.match(/chat\-line\-supporter\-([0-9]+)/) || [0, 0])[1];
            }
        }

        Message.create = function(text, author, type){
            if(typeof author == 'undefined') author = 'system';
            if(typeof type == 'undefined') type = '';
            return new Message(null, type, getFormattedTime(), author, text);
        }

        //Объект API
        const pt = {
            keyCodes: {
                left: 37,
                up: 38,
                right: 39,
                down: 40
            },
            Player: Player,
            Message: Message,
            move(dir, time){
                //передвинуть персонажа в направлении dir time секунд, затем вызвать callback
                w.dispatchEvent(new KeyboardEvent('keydown', {keyCode: this.keyCodes[dir]}));

                return new Promise((res, rej)=>{
                    setTimeout(()=>{
                        w.dispatchEvent(new KeyboardEvent('keyup', {keyCode: this.keyCodes[dir]}));
                        res();
                    }, time??150);
                });
            },
            crc32: function(r){for(var a,o=[],c=0;c<256;c++){a=c;for(var f=0;f<8;f++)a=1&a?3988292384^a>>>1:a>>>1;o[c]=a}for(var n=-1,t=0;t<r.length;t++)n=n>>>8^o[255&(n^r.charCodeAt(t))];return(-1^n)>>>0},
            action: {
                invoke(act){
                    //выполнить действие
                    let btn, btns = qsa('.action-button');

                    if(act.crc32){
                        btns.forEach(e=>{
                            if(!btn && pt.crc32(qs('canvas', e).toDataURL()) == act.crc32) btn = e;
                        });
                    }else if(act.text){
                        //Передано название действия
                        btns.forEach(e=>{
                            if(!btn && e.title.toLowerCase().includes(act.text.toLowerCase())) btn = e;
                        });
                    }else if(act.index){
                        //Передан номер действия
                        if(act.index == -1){
                            pt.chat.sendMessage('/e');
                            return;
                        }
                        btn = btns[act.index];
                    }

                    if(!btn) throw new Error('Action not found');
                    btn.click();
                },
                getAll(){
                    let btns = qsa('.action-button');
                    let ret = [];

                    btns.forEach((e,i)=>{
                        ret.push({
                            index: i,
                            text: e.title.toLowerCase(),
                            crc32: pt.crc32(qs('canvas', e).toDataURL())
                        });
                    });

                    return ret;
                },
                select(){
                    return new Promise((res,rej)=>{
                        let actionList = qs('.action-list');
                        let bx;

                        function listener(e){
                            let el = e.target.parentNode;

                            bx.close(true);
                            actionList.removeEventListener('contextmenu', listener);

                            res({
                                text: el.title.toLowerCase(),
                                crc32: pt.crc32(qs('canvas', el).toDataURL())
                            });
                        }

                        bx = box({ title: 'Выбор действия', text: 'Выберите действие, нажав на него правой кнопкой мыши', noOverlay: true });
                        box.onclose = ()=>rej();

                        actionList.addEventListener('contextmenu', listener);
                    });
                }
            },
            zoom: {
                set(n){
                    let settingsBtn = qs('div.settings-box button');
                    let style = merge(ce('style'), { innerText: '.settings-box-menu{ position: absolute; width: 1px; height: 1px; left: -999px; top: -999px; }' });
                    document.body.appendChild(style);

                    if(!qs('div.settings-height')){
                        settingsBtn = qs('div.settings-box button');
                        settingsBtn.click();
                    }
                    let inBtn = qs(`button[aria-label="Zoom in"]`);
                    let outBtn = qs(`button[aria-label="Zoom out"]`);
                    for(let i = 0; i < 5; i++) outBtn.click();

                    let num = 0;
                    if(n <= 4) num = n - 1;
                    else num = n - 2;

                    for(let j = 0; j < num; j++) inBtn.click();

                    return new Promise((res, rej)=>{
                        setTimeout(()=>{
                            document.body.removeChild(style);
                            settingsBtn.click();
                            res();
                        }, 150);
                    });
                },
                get(){
                    let settingsBtn = qs('div.settings-box button');
                    let style = merge(ce('style'), { innerText: '.settings-box-menu{ position: absolute; width: 1px; height: 1px; left: -999px; top: -999px; }' });
                    document.body.appendChild(style);

                    if(!qs('div.settings-height')){
                        settingsBtn = qs('div.settings-box button');
                        settingsBtn.click();
                    }

                    return new Promise((res, rej)=>{
                        setTimeout(()=>{
                            let z = parseInt(qs('div[title="Current zoom level"]').innerText.match(/Zoom ([0-9]{1})x/)[1]);
                            document.body.removeChild(style);
                            settingsBtn.click();
                            res(z);
                        }, 150);
                    });
                }
            },
            chat: {
                open(){
                    if(!qs('.chat-line')) qs('[title="Toggle chatlog"]').click();
                },
                getMessageByElement(msg){
                    let time = new Date(), timeArr = qs('.chat-line-timestamp', msg).innerText.split(':');
                    time.setHours(parseInt(timeArr[0]));
                    time.setMinutes(parseInt(timeArr[1]));

                    return new Message(
                        msg, //elem
                        (msg.className.replace(' chat-line-break', '').split(' ')[1]||'normal').replaceAll(' ', '').replace('chat-line', '').replace('-', ''), //type
                        time, //time
                        qs('.chat-line-name-content', msg).innerText, //author
                        qs('.chat-line-message', msg).innerText //text
                    );
                },
                getMessage(offset){
                    //Получение сообщения
                    let messages = qsa('.chat-line');
                    if(!messages || messages.length == 0){
                        //Сообщений нет, нужно открыть чат
                        qs('[title="Toggle chatlog"]').click();
                        messages = qsa('.chat-line');
                    }

                    let msg = messages[messages.length - ((offset??0)+1)];
                    if(!msg) return null;

                    return this.getMessageByElement(msg);
                },
                getMessages(start, end){
                    //Получение всех сообщений от start до end
                    let arr = [];
                    for(let i = (start??0); i < (end??100); i++){
                        let result = this.getMessage(i);
                        if(result) arr.push(result);
                    }
                    return arr;
                },
                sendMessage(text){
                    //Отправка сообщения
                    let chatBox = qs('.chat-box');
                    if(!chatBox || chatBox.getAttribute('hidden') === ''){
                        qs('[title="Toggle chat"]').click();
                        chatBox = qs('.chat-box');
                    }

                    let inp = qs('.chat-textarea');
                    inp.value = text;
                    //Обязательно нужно вызвать событие input, иначе не отправится
                    inp.dispatchEvent(new InputEvent('input'));

                    qs('[aria-label="Send message"]').click();

                    if(text.trim().length == 0) return;

                    pt.chat.disableReceive = true;

                    let mo = new MutationObserver(records=>{
                        records.forEach(record=>{
                            if(record.addedNodes.length > 0){
                                pt.chat.disableReceive = false;
                                mo.disconnect();
                            }
                        });
                    });

                    mo.observe(qs('.chat-log-scroll-inner'), { childList: true });
                },
                addMessage(msg){
                    //Добавляет сообщение в чат (только в чат, над игроком ничего отображено не будет)
                    if(typeof msg == 'string') msg = Message.create(msg);

                    let messages = qsa('.chat-line');
                    if(!messages || messages.length == 0){
                        qs('[title="Toggle chatlog"]').click();
                        messages = qsa('.chat-line');
                    }

                    let el = messages[messages.length - 1];
                    let nel = el.cloneNode(true);
                    el.parentNode.appendChild(nel);

                    qs('.chat-log-scroll-outer').scroll(0, Number.MAX_SAFE_INTEGER);

                    msg.elem = nel;
                    this.editMessage(msg);
                    return msg;
                },
                editMessage(msg){
                    //Редактирование сообщения
                    let el = msg.elem;
                    qs('.chat-line-name-content', el).innerText = msg.author;
                    qs('.chat-line-message', el).innerText = msg.text;
                },
                registerCommand(name, cb){
                    //Установка кастомной команды
                    this.commands[name] = cb;
                },
                logger: {
                    //Логгер чата
                    text: '',
                    observer: null,
                    isLogging: false,
                    start(){
                        //Запустить логгер
                        this.isLogging = true;
                        this.observer = new MutationObserver(r=>{
                            this.text += r[1].addedNodes[0].innerText+'\n';
                        });
                        this.observer.observe(qs('.chat-log-scroll-inner'), {childList: true});
                    },
                    stop(){
                        //Остановить логгер
                        this.isLogging = false;
                        this.observer.disconnect();
                        this.observer = null;
                        let text = this.text.toString();
                        this.text = '';
                        return text;
                    }
                },
                commands: [],
                hook: {
                    send: [],
                    receive: [],
                    attach(type, func){
                        return this[type].push(func) - 1;
                    },
                    detach(type, index){
                        this[type].splice(index, 1);
                    }
                }
            },
            status: {
                get(){
                    //Получить статус
                    let status = qs('ui-button', qs('status-box')).title;
                    return status.split('|')[1].trim().toLowerCase();
                },
                set(status){
                    //Установить статус
                    let stBtn, btns;
                    btns = qsa('.status-dropdown-menu a.dropdown-item.mt-1');
                    if(!btns || btns.length == 0){
                        let statusBtn = qs('.status-button')
                        statusBtn.click();
                        setTimeout(()=>statusBtn.click(), 200);
                        btns = qsa('.status-dropdown-menu a.dropdown-item.mt-1');
                    }
                    btns.forEach(e=>{
                        if(e.innerText.toLowerCase().includes(status.toLowerCase())) stBtn = e;
                    });
                    if(!stBtn) throw new Error('Status not found.');
                    stBtn.click();
                }
            },
            player: {
                get(){
                    //Получение объекта Player из диалога игрока
                    let ponyBox = qs('pony-box');
                    if(!ponyBox) throw new Error('Pony box not found.');

                    let tags = [];
                    qsa('.pony-box-tag', ponyBox).forEach(e=>{
                        tags.push(e.innerText.toLowerCase());
                    });

                    let status = '', statusEl = qs('.pony-box-name-status', ponyBox);
                    if(statusEl.getAttribute('ngbtooltip')){
                        status = statusEl.getAttribute('ngbtooltip').replaceAll(' ', '-').toLowerCase();
                    }else{
                        status = statusEl.className.replace('ng-fa-icon pony-box-name-status text-', '').toLowerCase();
                    }

                    let social = { name: null, url: null }, socialEl = qs('site-info', ponyBox);
                    if(socialEl){
                        social.name = qs('.sr-only', socialEl)?.innerText?.trim()||null;
                        social.url = (qs('a', socialEl)?.href)??null;
                    }

                    return new Player(ponyBox, qs('.pony-box-name-text', ponyBox).innerText, status, tags, social);
                },
                getByMessage(msg){
                    //Получение объекта Player по сообщению
                    let th = this;
                    return new Promise((res, rej)=>{
                        let ponyBox = qs('pony-box');
                        if(!ponyBox || qs('.pony-box-name-text', ponyBox).innerText != msg.author) qs('.chat-line-name-content', msg.elem).click();
                        setTimeout(()=>{
                            res(th.get());
                        }, 100);
                    });
                }
            },
            onGameLoad(f){
                this.gameLoadedListeners.push(f);
            },
            wshook: {
                enabled: readFromLS('disableWsHook') != 'true',
                send: [],
                receive: [],
                attach(type, func){
                    return this[type].push(func) - 1;
                },
                detach(type, index){
                    this[type].splice(index, 1);
                },
                enable(){
                    saveToLS('disableWsHook', 'false');
                    location.reload();
                },
                disable(){
                    saveToLS('disableWsHook', 'true');
                    location.reload();
                },
                getSocket(){
                    return ws;
                }
            },
            menuButton: {
                list: [],
                add(text, func){
                    return this.list.push({ text, func }) - 1;
                },
                remove(index){
                    this.list.splice(index, 1);
                }
            },
            graphics: {
                getGlContext(){
                    return gl;
                },
                readPixel(x, y){
                    let px = new Uint8Array(4);
                    let adjustedX = Math.floor(devicePixelRatio * x);
                    let adjustedY = Math.floor(devicePixelRatio * (gl.canvas.clientHeight - y));
                    gl.readPixels(adjustedX, adjustedY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
                    return px;
                },
                readAllPixels(){
                    let pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                    return pixels;
                }
            },
            tweaker: {
                optionsUI: tweakerUI,
                scriptsUI: scriptsUI,
                addScriptByURL: addScriptByURL,
                antiAfk: antiAfk,
                getScript: function(name){
                    return twScripts[name];
                },
                runScript: runScript
            },
            keyBind: {
                list: JSON.parse(readFromLS('twBinds') || '[]'),
                listener(e){
                    if(e.target == pt.chat.fta) return;
                    let key = e.code.includes('Key') ? e.code.replace('Key', '').toLowerCase() : e.code;

                    this.list.forEach(bind=>{
                        if(bind.key == key && bind.alt == e.altKey && bind.ctrl == e.ctrlKey){
                            switch(bind.action.type){
                                case 'js':
                                    w.eval(bind.action.value);
                                    break;
                                case 'chat':
                                    pt.chat.sendMessage(bind.action.value);
                                    break;
                                case 'action':
                                    pt.action.invoke(bind.action.value);
                                    break;
                            }
                        }
                    });
                },
                set(cfg, action){
                    let ob = this.list.find(e=>e.key==cfg.key&&e.alt==cfg.alt&&e.ctrl==cfg.ctrl);
                    if(ob){
                        ob.action = action;
                    }else{
                        cfg.action = action;
                        this.list.push(cfg);
                    }
                    saveToLS('twBinds', JSON.stringify(this.list));
                },
                delete(cfg){
                    let idx = this.list.findIndex(e=>e.key==cfg.key&&e.alt==cfg.alt&&e.ctrl==cfg.ctrl);
                    this.list.splice(idx, 1);
                    saveToLS('twBinds', JSON.stringify(this.list));
                },
                configFromString(str){
                    let cfg = { alt: false, ctrl: false, key: '' };
                    str.split('+').forEach(e=>{
                        if(e == 'alt') cfg.alt = true;
                        else if(e == 'ctrl') cfg.ctrl = true;
                        else cfg.key = e;
                    });
                    return cfg;
                }
            },
            gameLoadedListeners: [],
            stl: saveToLS
        }
        //[/API]

        if(localStorage.ptToWindow) w.pt = pt;

        function getFormattedDateTime(dd, td, md){
            let d = new Date();
            let arr = [
                (d.getDate()).toString(),
                (d.getMonth()+1).toString(),
                d.getFullYear().toString(),
                d.getHours().toString(),
                d.getMinutes().toString(),
                d.getSeconds().toString()
            ];

            arr.forEach((e,i,o)=>{
                o[i] = (e.length>1?e:'0'+e);
            });
            let date = arr.slice(0, 3), time = arr.slice(3);
            return `${date.join(dd)}${md}${time.join(td)}`;
        }

        function getFormattedDate(){
            let d = new Date();
            let arr = [
                (d.getDate()).toString(),
                (d.getMonth()+1).toString(),
                d.getFullYear().toString()
            ];

            arr.forEach((e,i,o)=>{
                o[i] = (e.length>1?e:'0'+e);
            });
            return `${arr.join('.')}`;
        }

        function getFormattedTime(){
            let d = new Date();
            let arr = [
                d.getHours().toString(),
                d.getMinutes().toString()
            ];

            arr.forEach((e,i,o)=>{
                o[i] = (e.length>1?e:'0'+e);
            });
            return `${arr.join(':')}`;
        }

        function rgbToHex(array, hash){
            let str = hash?'#':'';
            for(let i = 0; i < 3; i++){
                if(array[i] < 16) str += '0';
                str += array[i].toString(16);
            }
            return str;
        }

        let aaIid = 0;
        let lastActionTimeout = 0;
        function antiAfk(){
            if(aaIid){
                clearInterval(aaIid);
                qs('#canvas').removeEventListener('click', aaHandler);
                w.removeEventListener('click', aaHandler);
                w.removeEventListener('keydown', aaHandler);
                return;
            }

            qs('#canvas').addEventListener('click', aaHandler);
            w.addEventListener('click', aaHandler);
            w.addEventListener('keydown', aaHandler);

            aaIid = setInterval(()=>{
                lastActionTimeout++;

                if(lastActionTimeout >= 60){
                    setTimeout(()=>{
                        switch(Math.floor(Math.random() * 6)){
                            case 0: {
                                pt.action.invoke('turn head');
                                pt.action.invoke('turn head');
                                break;
                            }
                            case 1: {
                                pt.chat.sendMessage('/blink');
                                break;
                            }
                            case 3: {
                                pt.chat.sendMessage('/e');
                                break;
                            }
                            case 4: {
                                pt.action.invoke('boop');
                                break;
                            }
                            case 5: {
                                pt.chat.sendMessage('/yawn');
                                break;
                            }
                        }
                    }, Math.floor(Math.random() * 60000));
                }
            }, 10000);
        }

        function aaHandler(){
            lastActionTimeout = 0;
        }

        function getDBNames(cb){
            indexedDB.databases().then(db=>cb(db.map(e=>e.name)));
        }

        function getObjectStoreNames(db, cb){
            indexedDB.open(db).onsuccess = d=>cb(d.target.result.objectStoreNames);
        }

        function getDataFromDB(db, st, cb){
            try{
                let open = indexedDB.open(db);
                open.onsuccess = ()=>{
                    let db = open.result;
                    let tr = db.transaction(st, 'readonly');

                    try{
                        let storage = tr.objectStore(st);
                        let req = storage.getAll();
                        req.onsuccess = ()=>{
                            let obj = [];
                            for(let i in req.result){
                                let e = req.result[i];
                                obj.push(e);
                            }
                            if(cb) cb(obj);
                        }
                        req.onerror = ()=>{
                            if(cb) cb({}, req.error);
                        }
                    }catch(e){
                        if(cb) cb({}, e);
                    }
                }
                open.onerror = ()=>{
                    if(cb) cb({}, open.error);
                }
            }catch(e){
                if(cb) cb({}, e);
            }
        }

        function putDataToDB(db, st, ind, data, cb){
            try{
                let open = indexedDB.open(db);
                open.onsuccess = ()=>{
                    let db = open.result;
                    let tr = db.transaction(st, 'readwrite');

                    try{
                        let storage = tr.objectStore(st);
                        let req = storage.put(data, ind);
                        req.onsuccess = ()=>{
                            if(cb) cb(null);
                        }
                        req.onerror = ()=>{
                            if(cb) cb({}, req.error);
                        }
                    }catch(e){
                        if(cb) cb({}, e);
                    }
                }
                open.onerror = ()=>{
                    if(cb) cb({}, open.error);
                }
            }catch(e){
                if(cb) cb({}, e);
            }
        }

        function deleteDataFromDB(db, st, ind, cb){
            try{
                let open = indexedDB.open(db);
                open.onsuccess = ()=>{
                    let db = open.result;
                    let tr = db.transaction(st, 'readwrite');

                    try{
                        let storage = tr.objectStore(st);
                        let req = storage.delete(ind);
                        req.onsuccess = ()=>{
                            if(cb) cb(null);
                        }
                        req.onerror = ()=>{
                            if(cb) cb({}, req.error);
                        }
                    }catch(e){
                        if(cb) cb({}, e);
                    }
                }
                open.onerror = ()=>{
                    if(cb) cb({}, open.error);
                }
            }catch(e){
                if(cb) cb({}, e);
            }
        }

        function convertToPony(jsonStr){
            let jp = JSON.parse(jsonStr);
            let obj = {};
            obj.id = jp.id;
            obj.time = new Date(jp.time);
            obj.data = new Uint8Array(Object.values(jp.data));
            return obj;
        }

        function wshook(cb){
            cb = cb??console.log;

            let property = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data');
            let data = property.get;

            function msgHandler() {
                if (!(this.currentTarget instanceof WebSocket)) return data.call(this);

                let msg = data.call(this);

                Object.defineProperty(this, 'data', { value: msg });
                return cb({ data: msg, socket: this.currentTarget, event: this }) || msg;
            }

            property.get = msgHandler;
            Object.defineProperty(MessageEvent.prototype, 'data', property);
        }

        function saveChat(){
            let el = document.querySelector('.chat-log-scroll-inner');
            if(!el) return;
            let text = el.innerText.replaceAll('[', ' [');

            let l = document.createElement('a');
            l.href = URL.createObjectURL(new Blob([text]));
            l.download = `chatLog_${getFormattedDateTime('.', ':', '-')}.txt`
            l.click();
            URL.revokeObjectURL(l.href);
        }

        function box(obj){
            if(typeof obj == 'string') obj = {text: obj, title: ' '};

            let mh = ce('div');
            merge(mh.style, {
                position: 'fixed',
                left: '0',
                top: '0',
                width: '100%',
                height: '100%',
                zIndex: '999999',
                overflow: 'hidden',
                overflowY:  'auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'default',
                userSelect: 'none'
            });

            let wrapper = ce('div');
            wrapper.style.display = 'block';
            wrapper.style.fontSize = '120%';

            let header = ce('div');
            header.innerText = obj.header??obj.title??'';
            merge(header.style, {
                width: '100%',
                padding: '0.7em',
                borderBottom: 'solid 2px white'
            });

            let closeBtn = ce('span');
            closeBtn.innerText = '\u2573';
            merge(closeBtn.style, {
                paddingLeft: '0.5em',
                cursor: 'pointer',
                float: 'right'
            });
            closeBtn.addEventListener('click', ()=>{
                (obj.noOverlay?wrapper:mh).parentNode.removeChild((obj.noOverlay?wrapper:mh));
                if(obj.onclose) obj.onclose();
            });

            let abox = ce('div');
            merge(abox.style, {
                background: '#212121',
                color: 'white',
                border: 'solid 2px white',
                borderRadius: '3px',
                width: obj.fixedSize?((obj.width??600)+'px'):'',
                height: obj.fixedSize?((obj.height??400)+'px'):''
            });

            if(obj.noOverlay){
                merge(abox.style, {
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)'
                });
            }

            let text = ce('div');
            text.style.padding = '0.7em';
            if(obj.text) text.innerHTML = obj.text;
            else if(obj.elem) text.appendChild(obj.elem);
            else throw new Error('Необходимо задать свойство text или elem объекта.');

            header.appendChild(closeBtn);
            abox.appendChild(header);
            abox.appendChild(text);
            wrapper.appendChild(abox);

            if(obj.noOverlay){
                document.body.appendChild(wrapper);
            }else{
                mh.appendChild(wrapper);
                document.body.appendChild(mh);
            }

            return {
                input: obj,
                box: (obj.noOverlay?wrapper:mh),
                close: (f)=>{
                    (obj.noOverlay?wrapper:mh).parentNode.removeChild((obj.noOverlay?wrapper:mh));
                    if(obj.onclose && !f) obj.onclose();
                },
                hide: ()=>{
                    (obj.noOverlay?wrapper:mh).oldDisplay = (obj.noOverlay?wrapper:mh).style.display;
                    (obj.noOverlay?wrapper:mh).style.display = 'none';
                },
                show: ()=>{
                    (obj.noOverlay?wrapper:mh).style.display = (obj.noOverlay?wrapper:mh).oldDisplay;
                }
            };
        }

        function tweakerUI(){
            let d = ce('div'), cont = ce('div'), abox;

            cont.style.maxHeight = '20em';
            cont.style.overflow = 'auto';

            for(let i in twOptions){
                let e = twOptions[i];
                let el = ce('div');
                merge(el.style, {padding: '5px', margin: '5px', borderRadius: '5px', background: '#171717', cursor: 'pointer'});
                el.innerText = e.name;

                // eslint-disable-next-line no-loop-func
                el.addEventListener('click', ()=>{
                    let elem = ce('div'), des = ce('div'), inp = ce('input'), btn = ce('button'), bx;

                    des.innerText = e.description??'';

                    inp.type = e.type=='bool'?'checkbox':e.type;
                    if(e.type == 'bool') inp.checked = e.value;
                    else inp.value = e.value;
                    inp.style.display = 'block';
                    inp.style.margin = '1em auto';

                    btn.innerText = 'OK';
                    btn.className = 'btn btn-default';
                    btn.style.display = 'block';
                    btn.style.padding = '0.3em 2em';
                    btn.style.margin = '0 auto';
                    btn.addEventListener('click', ()=>{
                        twOptions[i].value = e.type=='bool'?inp.checked:inp.value;
                        bx.close();
                    });

                    elem.appendChild(des);
                    elem.appendChild(inp);
                    elem.appendChild(btn);

                    bx = box({
                        header: e.name,
                        elem: elem
                    });
                });
                cont.appendChild(el);
            }
            d.appendChild(cont);

            let btn = ce('button');
            btn.className = 'btn btn-default';
            btn.style.display = 'block';
            btn.style.padding = '0.3em 2em';
            btn.style.margin = '1em auto';
            btn.innerText = 'Сохранить';
            btn.addEventListener('click', ()=>{
                saveToLS('twOptions', JSON.stringify(twOptions));
                setTimeout(()=>location.reload(), 200);
            });
            d.appendChild(btn);

            abox = box({header: 'Настройки PTTW', elem: d});
        }

        function runScript(s){
            try{
                if(!s.lang || s.lang == 'js'){
                    return w.eval(decodeURIComponent(atob(s.code)));
                }else if(s.lang == 'python'){
                    if(!w.pyinit){
                        fetch('https://nekit270.ch/get.php?f=/files/brython.js').then(f=>{
                            f.text().then(t=>{
                                w.eval(t);
                                w.brython();
                                w.__BRYTHON__.imported.exec = {};
                                w.__BRYTHON__.imported.pt = pt;
                                w.eval(w.__BRYTHON__.py2js(decodeURIComponent(atob(s.code))).to_js());
                                w.pyinit = true;
                            });
                        });
                    }else{
                        w.eval(w.__BRYTHON__.py2js(decodeURIComponent(atob(s.code))).to_js());
                    }
                }
            }catch(ex){
                box({
                    header: 'Ошибка',
                    text: `В скрипте "${s.name}" произошла ошибка. Работа скрипта остановлена.<br><br>
                           <details>
                               <summary style="margin-bottom: 0.3em;">Информация об ошибке</summary>
                               <textarea readonly style="width: 100%; heigth: 3em; resize: none; background: inherit; color: inherit">${ex.toString()}</textarea><br>
                           </details><br>
                           Возможные варианты решения проблемы:
                           <ul>
                               <li>Попробуйте запустить скрипт еще раз</li>
                               <li>Если скрипт запрашивает данные, убедитесь в их корректности</li>
                               <li>Прочтите информацию о скрипте, там может быть указано решение данной проблемы</li>
                               <li>Свяжитесь с разработчиком скрипта: <a href="${s.dev[1]}" target="_blank">${s.dev[0]}</a></li>
                           </ul>
                       `
                });
                return ex;
            }
        }

        function scriptsUI(){
            let d = ce('div'), cont = ce('div'), abox;

            d.style.maxHeight = '20em';
            d.style.overflow = 'auto';

            twScripts.forEach(e=>{
                let el = ce('div'), btnCont = ce('div'), btnRun = ce('button'), btnInfo = ce('button'), btnEdit = ce('button'), btnDel = ce('button');
                merge(el.style, {padding: '5px', margin: '5px', borderRadius: '5px', background: '#171717', cursor: 'pointer'});
                el.innerText = e.name;
                el.addEventListener('click', ()=>{
                    abox.close();
                    setTimeout(()=>{
                        runScript(e);
                    }, 200);
                });

                btnCont.style.display = 'inline';
                btnCont.style.marginLeft = '5em';

                btnInfo.className = 'btn btn-default';
                btnInfo.innerHTML = '<svg role="img" aria-labelledby="svg-inline--fa-title-tP35bZCmxkgz" data-prefix="fas" data-icon="circle-info" class="svg-inline--fa fa-circle-info fa-fw fa-lg" xmlns="http://www3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512c141.4 0 256-114.6 256-256S397.4 0 256 0S0 114.6 0 256S114.6 512 256 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-144c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32z"></path></svg>';
                btnInfo.style.marginLeft = '0.2em';
                btnInfo.addEventListener('click', ev=>{
                    ev.stopPropagation();
                    box({header: `${e.name}`, text: `Версия: ${e.ver}<br>Разработчик: ${e.dev[0]}<br>Описание:<br>` + decodeURIComponent(atob(e.description))});
                });
                btnCont.appendChild(btnInfo);

                btnDel.className = 'btn btn-danger remove-button';
                btnDel.innerHTML = '<svg role="img" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="trash" class="svg-inline--fa fa-trash fa-fw" xmlns="http://www3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg>';
                btnDel.style.marginLeft = '0.2em';
                btnDel.addEventListener('click', ev=>{
                    ev.stopPropagation();
                    twScripts.splice(twScripts.indexOf(e), 1);
                    saveToLS('twScripts', JSON.stringify(twScripts));
                    abox.close();
                    scriptsUI();
                });
                btnCont.appendChild(btnDel);

                el.appendChild(btnCont);
                d.appendChild(el);
            });

            let btnAddCont = ce('div');
            btnAddCont.style.display = 'flex';
            btnAddCont.style.justifyContent = 'center';
            btnAddCont.style.marginTop = '1em';

            let btnAdd = ce('button');
            btnAdd.className = 'btn btn-success';
            btnAdd.innerText = 'Добавить';
            btnAdd.addEventListener('click', ()=>{
                abox.close();
                addScriptUI();
            });

            btnAddCont.appendChild(btnAdd);
            d.appendChild(btnAddCont);

            abox = box({header: 'Скрипты', elem: d});
        }

        function bindKey(action, callback){
            let el = ce('div');
            merge(el.style, {
                textAlign: 'center'
            });

            let kp = merge(ce('div'), {
                id:'key_preview',
                innerText: '<Нажмите любую клавишу>'
            });

            let ko = merge(ce('button'), {
                id:'key_ok',
                className:'btn btn-default',
                innerText:'OK'
            });
            merge(ko.style, {
                padding: '0.2em 1em',
                marginTop: '1em'
            });

            el.appendChild(kp);
            el.appendChild(ko);

            let abox = box({
                header: 'Назначить клавишу для '+action??'',
                elem: el,
                onclose: callback
            });

            let key = '';

            w.onkeydown = e=>{
                key = e.key;
                kp.innerText = e.key;
                e.preventDefault();
                e.stopPropagation();
                return false;
            }

            ko.addEventListener('click', ()=>{
                if(callback) callback(key);
                abox.close(true);
                w.onkeypress = null;
            });
        }

        function playersCount(){
            pt.chat.sendMessage('/playercounts');
            setTimeout(()=>{
                let text = pt.chat.getMessage().text;
                let total = text.match(/([0-9]+) на данном сервере/)[1];
                let thismap = text.match(/([0-9]+) на данной карте/)[1];

                box({header: 'Количество игроков', text: `Всего: ${total}<br>На данной карте: ${thismap}`});
            }, 200);
        }

        let miniMapEnabled = false;
        const miniMap = async function(){
            let mm = ce('canvas'), cnv = qs('#canvas');
            let c = mm.getContext('2d');

            merge(mm.style, {position: 'absolute', left: 0, top: 0, border: 'solid 3px white'});
            mm.width = cnv.width / 5;
            mm.height = cnv.height / 5;
            document.body.appendChild(mm);

            let zoom = await pt.zoom.get();
            localStorage.savedZoom = zoom;
            await pt.zoom.set(1);
            cnv.style.transform = `scale(${zoom})`;

            setInterval(()=>{
                c.drawImage(cnv, 0, 0, mm.width, mm.height);
            }, 3);

            setTimeout(async function t(){
                let z = await pt.zoom.get();
                if(z != 1){
                    console.log('not 1');
                    localStorage.savedZoom = z;
                    await pt.zoom.set(1);
                    cnv.style.transform = `scale(${z})`;
                }
                setTimeout(t, 500);
            }, 500);
        }

        function chatSearchUI(){
            let abox = box({
                header: 'Поиск в чате',
                text: `
                <input type="text" size="40" id="${randomString.get('pttw-search-inp')}" autocomplete="off"><br>
                <div>
                    <div style="padding-right: 3em; display: inline;"><input type="checkbox" id="${randomString.get('pttw-search-checkbox-msgtext')}" checked> Текст</div>
                    <div style="display: inline;"><input type="checkbox" id="${randomString.get('pttw-search-checkbox-name')}"> Имя</div>
                </div>
                <details>
                    <summary>Настройки</summary>
                    <div style="display: inline;"><input type="checkbox" id="${randomString.get('pttw-search-checkbox-regex')}"> Использовать регулярные выражения</div>
                </details><br>
                <div style="display: flex; justify-content: space-evenly;">
                    <button id="${randomString.get('pttw-search-ok-btn')}" class="btn btn-success">Найти</button>
                    <button id="${randomString.get('pttw-search-reset-btn')}" class="btn btn-danger">Сбросить</button>
                </div>
            `
            });
            let text = qs('#'+randomString.get('pttw-search-inp')),
                cbt = qs('#'+randomString.get('pttw-search-checkbox-msgtext')),
                cbn = qs('#'+randomString.get('pttw-search-checkbox-name')),
                cbr = qs('#'+randomString.get('pttw-search-checkbox-regex')),
                btnok = qs('#'+randomString.get('pttw-search-ok-btn')),
                btnr = qs('#'+randomString.get('pttw-search-reset-btn'));

            function check(msg){
                return (cbt.checked && msg.text.toLowerCase()[cbr.value?'match':'includes'](text.value.toLowerCase())) || (cbn.checked && msg.author.toLowerCase()[cbr.value?'match':'includes'](text.value.toLowerCase()));
            }

            btnok.addEventListener('click', ()=>{
                if(!cbt.checked && !cbn.checked) return;
                if(w.chatSearchIid) clearInterval(w.chatSearchIid);

                pt.chat.getMessages().forEach(e=>{
                    if(!check(e)) e.elem.style.display = 'none';
                });
                w.chatSearchIid = setInterval(()=>{
                    let msg = pt.chat.getMessage();
                    if(!check(msg)) msg.elem.style.display = 'none';
                }, 100);
            });

            btnr.addEventListener('click', ()=>{
                clearInterval(w.chatSearchIid);
                qsa('.chat-line').forEach(e=>{e.style.display = null});
            });
        }

        function spamBotUI(){
            let abox = box({
                header: 'Спам-бот',
                text: `
                <table><tr>
                    <td>Сообщение</td>
                    <td style="padding-left: 3em;"><input type="text" id="${randomString.get('pttw-spam-bot-msg')}" maxlength="68"></td>
                </tr><tr>
                    <td>Кол-во повторов</td>
                    <td style="padding-left: 3em;"><input type="number" id="${randomString.get('pttw-spam-bot-repeats')}" value="10"></td>
                </tr><tr>
                    <td>Задержка (в мс)</td>
                    <td style="padding-left: 3em;"><input type="number" id="${randomString.get('pttw-spam-bot-delay')}" value="400"></td>
                </tr></table><br>
                <div style="display: flex; justify-content: center;">
                    <button id="${randomString.get('pttw-spam-bot-ok-btn')}" class="btn btn-success">Начать</button>
                </div>
            `
            });
            qs('#'+randomString.get('pttw-spam-bot-ok-btn')).addEventListener('click', ()=>{
                let txt = qs('#'+randomString.get('pttw-spam-bot-msg')).value+'', rep = +qs('#'+randomString.get('pttw-spam-bot-repeats')).value, delay = +qs('#'+randomString.get('pttw-spam-bot-delay')).value;
                abox.close();
                setTimeout(()=>{
                    let i = 0;
                    setTimeout(function spam(){
                        pt.chat.sendMessage(txt.replaceAll('#i', i).replaceAll('#r', Math.floor(Math.random()*1000)));
                        i++;
                        if(i < rep) setTimeout(spam, delay);
                    }, delay);
                }, 200);
            });
        }

        function addScriptByURL(url, cb){
            (async ()=>{
                let f = await fetch(url);
                let obj = JSON.parse(await f.text());
                twScripts.push(obj);
                saveToLS('twScripts', JSON.stringify(twScripts));
                if(cb) cb();
            })();
        }

        function addScriptUI(){
            let abox = box({
                header: 'Добавить скрипт',
                text: `
                <div style="display: flex; justify-content: space-evenly;">
                    <button id="${randomString.get('pttw-add-script-btn-file')}" class="btn btn-default">Загрузить из файла</button>
                    <button id="${randomString.get('pttw-add-script-btn-url')}" class="btn btn-default">Загрузить по URL</button>
                </div><br>
                <textarea id="${randomString.get('pttw-add-script-ta')}"
                style="font-family: Consolas, monospace; width: 20em; height: 5em; resize: none;"
                placeholder="JSON"></textarea>
                <div style="display: flex; justify-content: center;">
                    <button id="${randomString.get('pttw-add-script-btn-ok')}" class="btn btn-success">Добавить</button>
                </div>
            `
            });
            let btnFile = qs('#'+randomString.get('pttw-add-script-btn-file')), btnURL = qs('#'+randomString.get('pttw-add-script-btn-url')), btnOk = qs('#'+randomString.get('pttw-add-script-btn-ok')), ta = qs('#'+randomString.get('pttw-add-script-ta'));

            btnFile.addEventListener('click', ()=>{
                let input = ce('input');
                input.type = 'file';
                input.accept = 'text/json, application/json';

                input.onchange = e=>{
                    let file = e.target.files[0];
                    let reader = new FileReader();
                    reader.readAsText(file, 'UTF-8');

                    reader.onload = readerEvent=>{
                        ta.value = readerEvent.target.result;
                    }
                }

                input.click();
            });

            btnURL.addEventListener('click', ()=>{
                let bx = box({
                    header: 'Загрузить по URL',
                    text: `
                    <input type="url" size="60" id="${randomString.get('pttw-add-script-urld-inp')}" placeholder="URL"><br>
                    <div style="display: flex; justify-content: center;">
                        <button id="${randomString.get('pttw-add-script-urld-btn-ok')}" class="btn btn-success">OK</button>
                    </div>
                `
                });
                let inp = qs('#'+randomString.get('pttw-add-script-urld-inp')), btn = qs('#'+randomString.get('pttw-add-script-urld-btn-ok'));
                btn.addEventListener('click', ()=>{
                    let val = inp.value + '';
                    bx.close();
                    (async ()=>{
                        let f = await fetch(val);
                        let t = await f.text();
                        ta.value = t;
                    })();
                });
            });

            btnOk.addEventListener('click', ()=>{
                let obj;
                try{
                    obj = JSON.parse(ta.value);
                }catch(e){
                    return;
                }
                if(obj.name && obj.ver && obj.dev && obj.description && obj.code){
                    abox.close();
                    twScripts.push(obj);
                    saveToLS('twScripts', JSON.stringify(twScripts));
                    scriptsUI();
                }
            });
        }

        function adlistUI(){
            function isSimilar(s1, s2){
                let lmatch = 0;
                const l1 = s1.length;
                const l2 = s2.length;
                for (let b =0; b< l1; b++) {
                    for ( let e = b+1; e<=l1; e++) {
                        const s1s = s1.slice(b,e);

                        if (s2.includes(s1s)) {
                            const ls = e-b;
                            if (lmatch < ls) {
                                lmatch = ls;
                            }
                        } else {
                            break;
                        }
                    }
                }
                return lmatch > l1/2 && lmatch > l2/2;
            }

            let d = ce('div'), cont = ce('div'), abox = {};

            cont.style.maxHeight = '20em';
            cont.style.overflow = 'auto';

            let keywords = ['набор', 'слышишь', 'слышите', 'открылся', 'открылась', 'открылось', 'хей', 'хэй', 'клуб', 'это же', 'ищу'];

            function updateAdList(){
                let savedAds = [];

                let ads = pt.chat.getMessages().filter(msg=>{
                    if(msg.type != 'normal') return false;

                    let rpt = false;
                    for(let sa of savedAds){
                        if(msg.text.trim().toLowerCase() == sa || isSimilar(sa, msg.text.trim().toLowerCase())){
                            rpt = true;
                            break;
                        }
                    }
                    if(rpt) return false;

                    let mc = false;
                    for(let word of keywords){
                        if(msg.text.trim().toLowerCase().includes(word)){
                            mc = true;
                            break;
                        }
                    }
                    if(!mc) return false;

                    savedAds.push(msg.text.trim().toLowerCase());
                    return true;
                });
                console.log(ads, savedAds);

                cont.innerHTML = '';

                for(let i in ads){
                    let e = ads[i];
                    let el = ce('div');
                    merge(el.style, {padding: '5px', margin: '5px', borderRadius: '5px', background: '#171717', cursor: 'pointer'});
                    el.innerText = e.text;

                    // eslint-disable-next-line no-loop-func
                    el.addEventListener('click', ()=>{
                        abox.close();

                        e.getPlayer().then(player=>{
                            player.action('send whisper');
                            player.close();
                        });
                    });
                    cont.appendChild(el);
                }
            }

            let btn = ce('button');
            btn.className = 'btn btn-default';
            btn.style.display = 'block';
            btn.style.padding = '0.3em 2em';
            btn.style.margin = '1em auto';
            btn.innerText = 'Обновить';
            btn.addEventListener('click', updateAdList);

            d.appendChild(cont);
            d.appendChild(btn);

            updateAdList();

            abox = box({header: 'Объявления', elem: d});
        }

        function replaceTextLinks(text){
            return text.replace(/(?<=(тгк|тг|tgc|tg)[\s:@]*)([A-Za-z0-9\-_]+)/g, (orig,_,name)=>`<a href="https://t.me/${name}">${orig}</a>`);
        }

        let q = [];
        location.search.slice(1).split('&').forEach(e=>{
            let arr = e.split('=');
            q[arr[0]] = decodeURIComponent(arr[1]);
        });

        twOptions = readFromLS('twOptions')?JSON.parse(readFromLS('twOptions')):{};

        if(q.tw_reset_options || !twOptions.hide_support_btn){
            twOptions.hide_support_btn = {
                name: 'Скрыть кнопку поддержки',
                type: 'bool',
                value: false
            };
        }

        if(q.tw_reset_options || !twOptions.hide_rules){
            twOptions.hide_rules = {
                name: 'Скрыть правила',
                description: 'Может исчезнуть кнопка начала игры, использовать не рекомендуется',
                type: 'bool',
                value: false
            };
        }

        if(q.tw_reset_options || !twOptions.color_picker){
            twOptions.color_picker = {
                name: 'Выбор цвета с карты',
                description: '',
                type: 'bool',
                value: true
            };
        }

        if(q.tw_reset_options || !twOptions.allow_html_in_chat){
            twOptions.allow_html_in_chat = {
                name: 'Разрешить HTML в чате',
                description: '',
                type: 'bool',
                value: false
            };
        }

        if(q.tw_reset_options || !twOptions.chat_color){
            twOptions.chat_color = {
                name: 'Цвет сообщений в чате',
                description: '',
                type: 'color',
                value: '#000000'
            };
        }

        if(q.tw_reset_options || !twOptions.do_not_highlight_supporter_messages){
            twOptions.do_not_highlight_supporter_messages = {
                name: 'Не выделять цветом сообщения саппортеров',
                description: '',
                type: 'bool',
                value: false
            };
        }

        if(q.tw_reset_options || !twOptions.disable_typing_animation){
            twOptions.disable_typing_animation = {
                name: 'Отключить анимацию печатания',
                description: 'Другие игроки не знают, печатаете вы сообщение или нет.\nПри этом вы по-прежнему видите, печатают ли другие.',
                type: 'bool',
                value: false
            };
        }

        if(q.tw_reset_options || !twOptions.anti_afk){
            twOptions.anti_afk = {
                name: 'Анти-АФК бот',
                description: 'Симулировать действия, чтобы обойти АФК-таймаут',
                type: 'bool',
                value: false
            };
        }

        if(q.tw_reset_options || !twOptions.brightness){
            twOptions.brightness = {
                name: 'Яркость',
                description: 'Яркость в процентах',
                type: 'number',
                value: '100'
            };
        }

        if(q.tw_reset_options || !twOptions.move_chat_input_box){
            twOptions.move_chat_input_box = {
                name: 'Передвинуть окно ввода в чат выше',
                description: 'Передвинуть поле ввода сообщения в чат выше, чтобы оно не закрывало панель действий',
                type: 'bool',
                value: false
            };
        }

        if(q.tw_reset_options || !twOptions.pass_keys_in_chat){
            twOptions.pass_keys_in_chat = {
                name: 'Движение с открытым чатом',
                description: 'При нажатии стрелочек, пока открыт чат, персонаж будет двигаться',
                type: 'bool',
                value: false
            };
        }

        if(q.tw_reset_options || !twOptions.translate_messages){
            twOptions.translate_messages = {
                name: 'Переводить сообщения',
                description: 'Предлагать перевод сообщений, написанных не на русском языке',
                type: 'bool',
                value: true
            };
        }

        // safe сервера дрянь, но для тех, кто вынужден на них играть и хочет разговаривать как человек...
        if(q.tw_reset_options || !twOptions.bypass_safe_filter){
            twOptions.bypass_safe_filter = {
                name: 'Обход мат-фильтра',
                description: 'Обход мат-фильтра safe серверов с помощью замены букв кириллицы на аналогичные буквы латиницы',
                type: 'bool',
                value: false
            };
        }

        if(q.tw_reset_options || !twOptions.stats_color){
            twOptions.stats_color = {
                name: 'Цвет статистики',
                description: '',
                type: 'color',
                value: '#000000'
            };
        }

        /*if(q.tw_reset_options || !twOptions.parse_profile_links){
            twOptions.parse_profile_links = {
                name: 'Парсить ссылки на соц.сети в профиле',
                description: 'Заменять указанные в имени профиля ссылки на каналы и профили в соцсетях на кликабельные ссылки\nНапример, кликабельными станут "тгк: pttwchat", "тг @pttwchat", "вк @slice_of_water"',
                type: 'bool',
                value: true
            };
        }

        if(q.tw_reset_options || !twOptions.parse_chat_links){
            twOptions.parse_chat_links = {
                name: 'Парсить ссылки в чате',
                description: '',
                type: 'bool',
                value: true
            };
        }

        if(q.tw_reset_options || !twOptions.mention_format){
            twOptions.mention_format = {
                name: 'Формат упоминаний',
                description: 'Определяет, на что будут заменяться упоминания вида @pttwchat\nВ значении данного параметра $name раскрывается как упоминание без символа @.',
                type: 'string',
                value: 'https://t.me/$name'
            };
        }*/

        saveToLS('twOptions', JSON.stringify(twOptions));

        if(!readFromLS('twScripts') || q.tw_reset_scripts){
            saveToLS('twScripts', '[]');
        }
        twScripts = JSON.parse(readFromLS('twScripts'));

        if(q.tw_add_script){
            if(confirm('Добавить этот скрипт?\n\n'+q.tw_add_script)) addScriptByURL(q.tw_add_script, ()=>{location.replace('/')});
        }

        if(q.tw_set_options !== undefined){
            let p = JSON.parse(q.tw_set_options);
            for(let i in p) twOptions[i].value = p[i];
            saveToLS('twOptions', JSON.stringify(twOptions));
            location.replace('/');
        }

        let psml = false, pgl = false;

        setTimeout(function csml(){
            if(!psml && qs('play-box')) startMenuLoaded();
            psml = qs('play-box');
            setTimeout(csml, 200);
        }, 200);

        setTimeout(function cgl(){
            if(!pgl && document.body.className.includes('playing')) gameLoaded();
            pgl = document.body.className.includes('playing');
            setTimeout(cgl, 200);
        }, 200);

        function startMenuLoaded(){
            if(onstartmenuloaded) onstartmenuloaded();

            if(readFromLS('disableWsHook') == 'false'){
                wshook(({socket,data})=>{
                    if(w.twDebug?.logInRequests) console.log(data);
                    if(!socket._send){
                        console.log('injecting hook to websocket object...');
                        ws = socket;
                        socket._send = socket.send;
                        socket.send = msg=>{
                            if(w.twDebug?.logOutRequests && !(msg instanceof ArrayBuffer) && !(msg.length == 3 && msg[0]==0 && msg[1]==64 && msg[2]==0)) console.log(msg);
                            if(pt.wshook.send.length > 0) pt.wshook.send.forEach(f=>f(data));
                            socket._send(msg);
                        }
                    }
                    if(pt.wshook.receive.length > 0) pt.wshook.receive.forEach(f=>f(data));
                });
            }else{
                console.log('wshook disabled');
            }

            if(twOptions.hide_support_btn.value){
                let iid = setInterval(()=>{
                    let supportBtn = qs('support-button');
                    try{
                        supportBtn.parentNode.removeChild(supportBtn);
                    }catch(e){}
                }, 200);
            }

            if(twOptions.hide_rules.value){
                let playNotice = document.querySelector('play-notice');
                playNotice.parentNode.removeChild(playNotice);

                let playabox = document.querySelector('play-box');
                for(let i = 0; i < playabox.children.length; i++){
                    let e = playabox.children.item(i);
                    if(e.nodeName != 'BUTTON') playabox.removeChild(e);
                }
            }

            if(q.tw_autoplay !== undefined){
                qs('button.btn.btn-lg.btn-success.text-ellipsis.flex-grow-1').click();
            }

            twScripts.forEach(e=>{
                if(e.autorun) runScript(e);
            });
        }

        function gameLoaded(){
            pt.gameLoadedListeners.forEach(f=>f());
            if(ongameloaded) ongameloaded();

            let ta = qs('.chat-textarea'), cb = qs('.chat-box');

            if(pt.chat.fta){
                ta.onfocus = ()=>pt.chat.fta.focus();
            }else{
                let fta = ta.cloneNode(true);
                pt.chat.fta = fta;
                merge(ta.style, { position: 'absolute', left: '-9999px', top: '-9999px' });
                ta.parentNode.appendChild(fta);

                if(twOptions.move_chat_input_box.value){
                    cb.style.position = 'absolute';
                    cb.style.top = '-6em';
                }

                let settingTA = false;

                ta.onfocus = ()=>fta.focus();

                function ftaSend(){
                    let val = fta.value.replaceAll('\r', '').replaceAll('\n', '');
                    let arr = val.split(' ');
                    arr[0] = arr[0].replace('/', '');

                    if(val[0] == '/' && pt.chat.commands[arr[0]]){
                        pt.chat.commands[arr[0]](arr.slice(1));
                        pt.chat.sendMessage('');
                    }else{
                        pt.chat.hook.send.forEach(hook=>{
                            val = hook(val);
                        });

                        pt.chat.sendMessage(val);
                    }
                    fta.value = '';
                }

                fta.addEventListener('input', ()=>{
                    if(fta.value.includes('\n')){
                        ftaSend();
                    }
                    if(!twOptions.disable_typing_animation.value){
                        settingTA = true;
                        ta.value = fta.value;
                        settingTA = false;
                        ta.dispatchEvent(new InputEvent('input'));
                    }
                });

                let sendBtn = fta.parentNode.parentNode.querySelectorAll('button')[1];
                sendBtn.onclick = e=>{
                    e.stopImmediatePropagation();
                    ftaSend();
                    return false;
                }

                fta.addEventListener('keydown', e=>{
                    if(e.key == 'Escape') pt.chat.sendMessage('');

                    if(twOptions.pass_keys_in_chat.value){
                        if(Object.values(pt.keyCodes).includes(e.keyCode)){
                            e.preventDefault();
                            dispatchEvent(new KeyboardEvent('keydown', { keyCode: e.keyCode }));
                            return false;
                        }
                    }
                });

                fta.addEventListener('keyup', e=>{
                    if(twOptions.pass_keys_in_chat.value){
                        if(Object.values(pt.keyCodes).includes(e.keyCode)){
                            e.preventDefault();
                            dispatchEvent(new KeyboardEvent('keyup', { keyCode: e.keyCode }));
                            return false;
                        }
                    }
                });

                w.addEventListener('keyup', e=>{
                    if(e.keyCode == 191 && fta.value == ''){
                        fta.focus();
                        fta.value = '/';
                    }

                    pt.keyBind.listener(e);
                });
            }

            let ruRegex = /^[а-яёА-ЯЁ0-9\-\.\?\!\)\(\,\:\/\-\*\@\#\$\%\^\&\_\=\[\]\;\"\'\<\>\{\}\~\`\\\+ ]+$/;

            let log = qs('.chat-log-scroll-inner');
            new MutationObserver(nodes=>{
                if(nodes.filter(n=>n.addedNodes.length > 0).length == 1){
                    let node = nodes.find(n=>n.addedNodes.length > 0).addedNodes[0];
                    if(!pt.chat.disableReceive && !node.className.includes('meta-line')){
                        pt.chat.hook.receive.forEach(hook=>hook(pt.chat.getMessageByElement(node)));
                    }
                }

                nodes.forEach(nd=>{
                    if(nd.addedNodes?.length > 0){
                        nd.addedNodes.forEach(node=>{
                            let msg = qs('.chat-line-message', node);
                            if(!msg || node.className.includes('meta-line')) return;

                            if(twOptions.translate_messages.value){
                                let text = msg.innerText;

                                if(!qs('a', msg) && !node.className.includes('system') && text.trim().length > 0 && !ruRegex.test(text)){
                                    let trEl = document.createElement('a');
                                    trEl.href = 'javascript:void(0)';
                                    trEl.innerText = 'Перевести';
                                    trEl.addEventListener('click', async e=>{
                                        e.preventDefault();
                                        let translated = await (await fetch('https://nekit270.ch/pttw/api/translate.php?text='+encodeURIComponent(text))).text();
                                        msg.innerText = translated;
                                        return false;
                                    });

                                    msg.append(' ', trEl);
                                }
                            }
                        });
                    }
                });
            }).observe(log, { childList: true });

            pt.chat.getMessages().forEach(msg=>{
                if(!['system', 'meta-line'].includes(msg.type)){
                    if(twOptions.translate_messages.value){
                        if(!qs('.chat-line-message a', msg.elem) && msg.text.trim().length > 0 && !ruRegex.test(msg.text)){
                            let trEl = document.createElement('a');
                            trEl.href = 'javascript:void(0)';
                            trEl.innerText = 'Перевести';
                            trEl.addEventListener('click', async e=>{
                                e.preventDefault();
                                msg.text = await (await fetch('https://nekit270.ch/pttw/api/translate.php?text='+encodeURIComponent(msg.text))).text();
                                pt.chat.editMessage(msg);
                                return false;
                            });

                            qs('.chat-line-message', msg.elem).append(' ', trEl);
                        }
                    }
                }
            });

            pt.chat.registerCommand('options', tweakerUI);
            pt.chat.registerCommand('scripts', scriptsUI);
            pt.chat.registerCommand('adlist', adlistUI);

            pt.chat.registerCommand('setopt', args=>{
                twOptions[args[0]].value = args[1];
                saveToLS('twOptions', JSON.stringify(twOptions));
            });

            pt.chat.registerCommand('reconnect', args=>{
                onstartmenuloaded = ()=>{
                    qs('button.btn.btn-lg.btn-success').click();
                    onstartmenuloaded = null;
                }
                pt.chat.sendMessage((args[0] == '1'?'/unstuck':'/leave'));
            });

            pt.chat.registerCommand('spawn', args=>{
                onstartmenuloaded = ()=>{
                    qs('button.btn.btn-lg.btn-success').click();
                    onstartmenuloaded = null;
                }
                pt.chat.sendMessage(('/unstuck'));
            });

            pt.chat.registerCommand('bri', args=>{
                qs('#canvas').style.filter = `brightness(${parseFloat(args[0])})`;
            });

            pt.chat.registerCommand('savechat', saveChat);

            pt.chat.registerCommand('dlprev', ()=>{
                let el = qs('.portrait-box canvas');
                if(!el) return;

                let a = ce('a');
                a.href = el.toDataURL();
                a.download = pt.player.get().name + '.png';
                a.click();
            });

            pt.chat.registerCommand('recl', args=>{
                if(args[0] == 'save'){
                    getDBNames(names=>{
                        let db = names[0];
                        getDataFromDB(db, 'recycle', recl=>{
                            let str = JSON.stringify(recl[parseInt(args[1])]);
                            let a = document.createElement('a');
                            a.href = 'data:application/json;,'+str;
                            a.download = `char${args[1]}.pttw-char.json`;
                            a.click();
                        });
                    });
                }else if(args[0] == 'load'){
                    let input = ce('input');
                    input.type = 'file';
                    input.accept = 'text/json, application/json';

                    input.onchange = e=>{
                        let file = e.target.files[0];
                        let reader = new FileReader();
                        reader.readAsText(file, 'UTF-8');

                        reader.onload = readerEvent=>{
                            let value = readerEvent.target.result;
                            let pony = convertToPony(value);
                            getDBNames(names=>{
                                let db = names[0];
                                putDataToDB(db, 'recycle', parseInt(args[1]), pony, ()=>{
                                    location.reload();
                                });
                            });
                        }
                    }

                    input.click();
                }else if(args[0] == 'clear'){
                    getDBNames(names=>{
                        let db = names[0];
                        getDataFromDB(db, 'recycle', recl=>{
                            for(let i = 0; i < recl.length; i++){
                                deleteDataFromDB(db, 'recycle', i);
                            }
                        });
                    });
                }else{
                    pt.chat.addMessage('Использование: /recl <save|load|clear> [индекс]\nИмпорт/экспорт скинов в корзину.\nsave - сохранить скин\nload - загрузить скин\nclear - очистить корзину');
                }
            });

            pt.chat.registerCommand('transferconfig', ()=>{
                saveToLS('twOptions', localStorage.twOptions);
                saveToLS('twScripts', localStorage.twScripts);
                if(localStorage.disableWsHook) saveToLS('disableWsHook', localStorage.disableWsHook);
                if(localStorage.trLang) saveToLS('trLang', localStorage.trLang);
                localStorage.removeItem('twOptions');
                localStorage.removeItem('twScripts');
                localStorage.removeItem('disableWsHook');
                localStorage.removeItem('trLang');
                setTimeout(()=>location.reload(), 200);
            });

            if(!readFromLS('trLang')) saveToLS('trLang', '0');

            pt.chat.registerCommand('tr', args=>{
                if(args.length == 0){
                    pt.chat.addMessage('Использование: /tr <код языка> | /tr 0');
                }

                if(args.length > 1){
                    let xhr = new XMLHttpRequest();
                    xhr.open('GET', `https://nekit270.ch/pttw/api/translate.php?text=${args.slice(1).join(' ')}&from=auto&to=${args[0]}`, false);
                    xhr.send();

                    pt.chat.sendMessage(xhr.responseText);
                }else{
                    saveToLS('trLang', args[0]);
                }
            });

            pt.chat.hook.attach('send', msg=>{
                if(readFromLS('trLang') == '0') return msg;

                let xhr = new XMLHttpRequest();
                xhr.open('GET', `https://nekit270.ch/pttw/api/translate.php?text=${encodeURIComponent(msg)}&from=auto&to=${readFromLS('trLang')}`, false);
                xhr.send();

                return xhr.responseText;
            });

            pt.chat.registerCommand('charlimit', args=>{
                pt.chat.fta.maxLength = (args[0]=='0')?1410065407:parseInt(args[0]);
            });

            pt.chat.registerCommand('swc', args=>{
                qs('.chat-box-type').click();
            });

            pt.chat.registerCommand('bind', async args=>{
                if(args.length < 2){
                    pt.chat.addMessage('Использование: /bind <сочетание клавиш> <действие> <значение>');
                    return;
                }

                let cfg = pt.keyBind.configFromString(args[0]);

                if(args[1] == '-' || args[1] == 'delete'){
                    pt.keyBind.delete(cfg);
                }else{
                    pt.keyBind.set(cfg, {
                        type: args[1],
                        value: (args[1]=='action')?(args.length>2?{text:args.slice(2).join(' ')}:await pt.action.select()):args.slice(2).join(' ')
                    });
                }
            });

            if(twOptions.do_not_highlight_supporter_messages.value){
                if(!qs('#no-sup-style')){
                    let st = ce('style');
                    st.id = 'no-sup-style';

                    let sttxt = '';
                    for(let i = 0; i < 10; i++){
                        sttxt += `.chat-line-supporter-${i} { color: inherit; }\n`;
                    }

                    st.appendChild(document.createTextNode(sttxt));
                    document.head.appendChild(st);
                }
            }

            if(twOptions.color_picker.value){
                window.addEventListener('mouseup', e=>{
                    //console.log(e.x, e.y);
                    if(e.altKey) alert(rgbToHex(pt.graphics.readPixel(e.clientX, e.clientY)));
                });
                window.addEventListener('mousemove', e=>{
                    if(e.altKey) e.target.style.cursor = 'crosshair';
                    else e.target.style.cursor = null;
                });
            }

            if(twOptions.allow_html_in_chat.value){
                setInterval(()=>{
                    qsa('.chat-line-message').forEach(e=>{
                        if(e.innerText.includes('<') && e.innerText.includes('>')){
                            e.innerHTML = e.innerText;
                        }
                    });
                }, 200);
            }

            if(twOptions.chat_color.value != '#000000'){
                if(qs('#tw-chat-color')) return;

                let st = document.createElement('style');
                st.id = 'tw-chat-color';
                st.appendChild(document.createTextNode(`div.chat-line{color: ${twOptions.chat_color.value};}`));
                document.body.appendChild(st);
            }

            if(twOptions.anti_afk.value){
                antiAfk();
            }

            if(+twOptions.brightness.value != 100){
                qs('#canvas').style.filter = `brightness(${+twOptions.brightness.value / 100})`;
            }

            if(twOptions.bypass_safe_filter.value){
                pt.chat.hook.attach('send', msg=>{
                    return msg.replaceAll('у', 'y').replaceAll('е', 'e').replaceAll('х', 'x').replaceAll('а', 'a').replaceAll('р', 'p').replaceAll('о', 'o').replaceAll('с', 'c');
                });
            }

            if(twOptions.stats_color.value != '#000000'){
                qs('#stats').style.color = twOptions.stats_color.value;
            }

            setInterval(()=>{
                if(qs('.settings-height')){
                    try{
                        if(!qs('#'+randomString.get('pttw-options-btn'))){
                            function createButton(text, onclick, id){
                                let btn = ce('a');
                                if(id) btn.id = id;
                                btn.className = 'dropdown-item mb-1';
                                btn.onclick = e=>{
                                    e.preventDefault();
                                    onclick();
                                    return false;
                                }

                                let set = qs('.settings-height'), sb = qs('a[title="Open game settings"]');
                                btn.appendChild(qs('fa-icon', sb).cloneNode(true));
                                btn.append(text);
                                set.insertBefore(btn, sb);
                            }

                            createButton('Настройки PTTW', tweakerUI, randomString.get('pttw-options-btn'));
                            createButton('Скрипты PTTW', scriptsUI);

                            pt.menuButton.list.forEach(btn=>{
                                createButton(btn.text, btn.func);
                            });
                        }
                    }catch(e){}
                }

                if(qs('.chat-log-tabs')){
                    if(!qs('#'+randomString.get('pttw-chat-search-btn'))){
                        let tabs = qs('.chat-log-tabs');
                        let el = ce('button');
                        merge(el.style, {
                            marginLeft: '0.3em'
                        });
                        el.id = randomString.get('pttw-chat-search-btn');
                        el.className = 'btn btn-default';
                        el.innerText = 'Поиск';
                        el.addEventListener('click', chatSearchUI);
                        tabs.appendChild(el);
                    }

                    if(!qs('#'+randomString.get('pttw-chat-spam-btn'))){
                        let tabs = qs('.chat-log-tabs');
                        let el = ce('button');
                        merge(el.style, {
                            marginLeft: '0.3em'
                        });
                        el.id = randomString.get('pttw-chat-spam-btn');
                        el.className = 'btn btn-default';
                        el.innerText = 'Спам-бот';
                        el.addEventListener('click', spamBotUI);
                        tabs.appendChild(el);
                    }
                }
            }, 20);

            setInterval(()=>{
                try{
                    let player = pt.player.get();

                    if(!player.elem.dataset.linksParsed && twOptions.parse_profile_links){
                        player.elem.dataset.linksParsed = '1';
                        let nameEl = qs('.pony-box-name-text', player.elem);
                        //nameEl.innerHTML = replaceTextLinks(nameEl.innerHTML);
                    }

                    if(player.social.name == 'vkontakte'){
                        let name = player.social.url.split('/').at(-1);
                        let siteInfo = qs('.site-info', player.elem);

                        if(siteInfo.dataset.vkParsed != name){
                            siteInfo.dataset.vkParsed = name;

                            fetch(`https://nekit270.ch/pttw/api/vk_get_user.php?user=${name}`).then(ft=>{
                                ft.json().then(data=>{
                                    if(data.response && data.response?.length > 0){
                                        let user = data.response[0];
                                        siteInfo.append(`  ${user.first_name} ${user.last_name}`);
                                        siteInfo.title = `Статус: ${user.status}`;
                                    }
                                });
                            });
                        }
                    }
                }catch(e){}
            }, 150);
        }
    }catch(e){
        if(confirm('Произошла критическая ошибка при инициализации мода: \n' + e + '\n\nОтправить отчёт о проблеме? Будет передан только указанный выше текст ошибки и некоторая диагностическая информация, например, версия браузера.')){
            fetch('https://nekit270.ch/pttw/api/sendErrorReport.php', {
                method: 'POST',
                body: JSON.stringify({
                    error: e.toString(),
                    userAgent: navigator.userAgent,
                    userAgentData: navigator.userAgentData
                })
            });
        }
    }
})();
