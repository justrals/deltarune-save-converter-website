class GMSListDecoder {
    constructor(hex) {
        if (!hex.startsWith("2E010000") && !hex.startsWith("2F010000"))
            throw new Error("Not a ds_list");
        if (hex.length % 2) throw new Error("Odd-length hex");
        const bytes = new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
        const dv = new DataView(bytes.buffer);
        this.items = [];
        let i = 8;
        while (i < bytes.length) {
            const type = dv.getInt32(i, true); i += 4;
            if (type === 0 || type === 10 || type === 13) {
                this.items.push({ type: "real", value: dv.getFloat64(i, true) });
                i += 8;
            } else if (type === 1 || type === 2) {
                const len = dv.getInt32(i, true); i += 4;
                const str = new TextDecoder("ascii").decode(bytes.slice(i, i + len));
                i += len;
                this.items.push({ type: "string", value: str });
            } else {
                throw new Error(`Unknown list type ${type} at offset ${i - 4}`);
            }
        }
    }
    getReal(idx) { return this.items[idx]?.type === "real" ? this.items[idx].value : 0; }
    getString(idx) { return this.items[idx]?.type === "string" ? this.items[idx].value : ""; }
    toRealArray(out, len) { for (let i = 0; i < len; i++) out[i] = this.getReal(i); }
    toStringArray(out, len) { for (let i = 0; i < len; i++) out[i] = this.getString(i); }
}

class GMSListEncoder {
    constructor(items = []) { this.items = items; }
    getBytes() {
        const parts = [];
        const hdr = new ArrayBuffer(8);
        const dv = new DataView(hdr);
        dv.setInt32(0, 0x12E, true);
        dv.setInt32(4, this.items.length, true);
        parts.push(hdr);
        for (const item of this.items) {
            if (item.type === "real") {
                const buf = new ArrayBuffer(12);
                const v = new DataView(buf);
                v.setInt32(0, 0, true);
                v.setFloat64(4, item.value, true);
                parts.push(buf);
            } else {
                const enc = new TextEncoder().encode(item.value);
                const buf = new ArrayBuffer(8 + enc.length);
                const v = new DataView(buf);
                v.setInt32(0, 2, true);
                v.setInt32(4, enc.length, true);
                new Uint8Array(buf, 8).set(enc);
                parts.push(buf);
            }
        }
        const total = parts.reduce((s, b) => s + b.byteLength, 0);
        const out = new Uint8Array(total);
        let off = 0;
        for (const p of parts) { out.set(new Uint8Array(p), off); off += p.byteLength; }
        return out;
    }
    getString() {
        return Array.from(this.getBytes()).map(b => b.toString(16).padStart(2, "0").toUpperCase()).join("");
    }
}

const SAVFormat = {
    extract(text) {
        text = text.split("\0")[0];
        return JSON.parse(text);
    },
    pack(data) {
        let json = JSON.stringify(data);
        json = json.replace(/\\u0022/g, '\\"');
        return json;
    }
};

class DeltaruneCh1 {
    constructor() {
        this.truename = ""; this.othername = new Array(6).fill("");
        this.Char = [0, 0, 0]; this.gold = 0; this.xp = 0; this.lv = 0; this.inv = 0; this.invc = 0; this.darkzone = 0;
        this.hp = [0, 0, 0, 0]; this.maxhp = [0, 0, 0, 0]; this.at = [0, 0, 0, 0]; this.df = [0, 0, 0, 0]; this.mag = [0, 0, 0, 0];
        this.guts = [0, 0, 0, 0]; this.charweapon = [0, 0, 0, 0]; this.chararmor1 = [0, 0, 0, 0]; this.chararmor2 = [0, 0, 0, 0];
        this.weaponstyle = ["", "", "", ""];
        this.itemat = Array.from({ length: 4 }, () => [0, 0, 0, 0]); this.itemdf = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
        this.itemmag = Array.from({ length: 4 }, () => [0, 0, 0, 0]); this.itembolts = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
        this.itemgrazeamt = Array.from({ length: 4 }, () => [0, 0, 0, 0]); this.itemgrazesize = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
        this.itemboltspeed = Array.from({ length: 4 }, () => [0, 0, 0, 0]); this.itemspecial = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
        this.spell = Array.from({ length: 4 }, () => new Array(12).fill(0));
        this.boltspeed = 0; this.grazeamt = 0; this.grazesize = 0;
        this.item = new Array(13).fill(0); this.keyitem = new Array(13).fill(0);
        this.weapon = new Array(13).fill(0); this.armor = new Array(13).fill(0);
        this.tension = 0; this.maxtension = 0; this.lweapon = 0; this.larmor = 0; this.lxp = 0; this.llv = 0;
        this.lgold = 0; this.lhp = 0; this.lmaxhp = 0; this.lat = 0; this.ldf = 0; this.lwstrength = 0; this.ladef = 0;
        this.litem = new Array(8).fill(0); this.phone = new Array(8).fill(0);
        this.flag = new Array(9999).fill(0); this.plot = 0; this.currentroom = 0; this.time = 0;
    }
    readPC(lines) {
        let i = 0;
        this.truename = lines[i++];
        for (let j = 0; j < 6; j++) this.othername[j] = lines[i++];
        for (let j = 0; j < 3; j++) this.Char[j] = +lines[i++];
        this.gold = +lines[i++]; this.xp = +lines[i++]; this.lv = +lines[i++]; this.inv = +lines[i++];
        this.invc = +lines[i++]; this.darkzone = +lines[i++];
        for (let ch = 0; ch < 4; ch++) {
            this.hp[ch] = +lines[i++]; this.maxhp[ch] = +lines[i++]; this.at[ch] = +lines[i++];
            this.df[ch] = +lines[i++]; this.mag[ch] = +lines[i++]; this.guts[ch] = +lines[i++];
            this.charweapon[ch] = +lines[i++]; this.chararmor1[ch] = +lines[i++]; this.chararmor2[ch] = +lines[i++];
            this.weaponstyle[ch] = lines[i++];
            for (let s = 0; s < 4; s++) {
                this.itemat[ch][s] = +lines[i++]; this.itemdf[ch][s] = +lines[i++]; this.itemmag[ch][s] = +lines[i++];
                this.itembolts[ch][s] = +lines[i++]; this.itemgrazeamt[ch][s] = +lines[i++]; this.itemgrazesize[ch][s] = +lines[i++];
                this.itemboltspeed[ch][s] = +lines[i++]; this.itemspecial[ch][s] = +lines[i++];
            }
            for (let s = 0; s < 12; s++) this.spell[ch][s] = +lines[i++];
        }
        this.boltspeed = +lines[i++]; this.grazeamt = +lines[i++]; this.grazesize = +lines[i++];
        for (let j = 0; j < 13; j++) { this.item[j] = +lines[i++]; this.keyitem[j] = +lines[i++]; this.weapon[j] = +lines[i++]; this.armor[j] = +lines[i++]; }
        this.tension = +lines[i++]; this.maxtension = +lines[i++]; this.lweapon = +lines[i++]; this.larmor = +lines[i++];
        this.lxp = +lines[i++]; this.llv = +lines[i++]; this.lgold = +lines[i++]; this.lhp = +lines[i++];
        this.lmaxhp = +lines[i++]; this.lat = +lines[i++]; this.ldf = +lines[i++]; this.lwstrength = +lines[i++]; this.ladef = +lines[i++];
        for (let j = 0; j < 8; j++) { this.litem[j] = +lines[i++]; this.phone[j] = +lines[i++]; }
        for (let j = 0; j < 9999; j++) this.flag[j] = +lines[i++];
        this.plot = +lines[i++]; this.currentroom = +lines[i++]; this.time = +lines[i++];
    }
    writePC() {
        const lines = [];
        const push = v => lines.push(String(v));
        push(this.truename);
        for (let j = 0; j < 6; j++) push(this.othername[j]);
        for (let j = 0; j < 3; j++) push(this.Char[j]);
        push(this.gold); push(this.xp); push(this.lv); push(this.inv); push(this.invc); push(this.darkzone);
        for (let ch = 0; ch < 4; ch++) {
            push(this.hp[ch]); push(this.maxhp[ch]); push(this.at[ch]); push(this.df[ch]); push(this.mag[ch]);
            push(this.guts[ch]); push(this.charweapon[ch]); push(this.chararmor1[ch]); push(this.chararmor2[ch]);
            push(this.weaponstyle[ch]);
            for (let s = 0; s < 4; s++) {
                push(this.itemat[ch][s]); push(this.itemdf[ch][s]); push(this.itemmag[ch][s]); push(this.itembolts[ch][s]);
                push(this.itemgrazeamt[ch][s]); push(this.itemgrazesize[ch][s]); push(this.itemboltspeed[ch][s]); push(this.itemspecial[ch][s]);
            }
            for (let s = 0; s < 12; s++) push(this.spell[ch][s]);
        }
        push(this.boltspeed); push(this.grazeamt); push(this.grazesize);
        for (let j = 0; j < 13; j++) { push(this.item[j]); push(this.keyitem[j]); push(this.weapon[j]); push(this.armor[j]); }
        push(this.tension); push(this.maxtension); push(this.lweapon); push(this.larmor); push(this.lxp); push(this.llv);
        push(this.lgold); push(this.lhp); push(this.lmaxhp); push(this.lat); push(this.ldf); push(this.lwstrength); push(this.ladef);
        for (let j = 0; j < 8; j++) { push(this.litem[j]); push(this.phone[j]); }
        for (let j = 0; j < 9999; j++) push(this.flag[j]);
        push(this.plot); push(this.currentroom); push(this.time);
        return lines.join("\r\n");
    }
    readConsole(lines) {
        let i = 0;
        this.truename = lines[i++];
        new GMSListDecoder(lines[i++]).toStringArray(this.othername, 6);
        for (let j = 0; j < 3; j++) this.Char[j] = +lines[i++];
        this.gold = +lines[i++]; this.xp = +lines[i++]; this.lv = +lines[i++]; this.inv = +lines[i++];
        this.invc = +lines[i++]; this.darkzone = +lines[i++];
        new GMSListDecoder(lines[i++]).toRealArray(this.hp, 4);
        new GMSListDecoder(lines[i++]).toRealArray(this.maxhp, 4);
        new GMSListDecoder(lines[i++]).toRealArray(this.at, 4);
        new GMSListDecoder(lines[i++]).toRealArray(this.df, 4);
        new GMSListDecoder(lines[i++]).toRealArray(this.mag, 4);
        new GMSListDecoder(lines[i++]).toRealArray(this.guts, 4);
        new GMSListDecoder(lines[i++]).toRealArray(this.charweapon, 4);
        new GMSListDecoder(lines[i++]).toRealArray(this.chararmor1, 4);
        new GMSListDecoder(lines[i++]).toRealArray(this.chararmor2, 4);
        new GMSListDecoder(lines[i++]).toStringArray(this.weaponstyle, 4);
        for (let ch = 0; ch < 4; ch++) {
            for (let s = 0; s < 4; s++) {
                this.itemat[ch][s] = +lines[i++]; this.itemdf[ch][s] = +lines[i++]; this.itemmag[ch][s] = +lines[i++];
                this.itembolts[ch][s] = +lines[i++]; this.itemgrazeamt[ch][s] = +lines[i++]; this.itemgrazesize[ch][s] = +lines[i++];
                this.itemboltspeed[ch][s] = +lines[i++]; this.itemspecial[ch][s] = +lines[i++];
            }
            for (let s = 0; s < 12; s++) this.spell[ch][s] = +lines[i++];
        }
        this.boltspeed = +lines[i++]; this.grazeamt = +lines[i++]; this.grazesize = +lines[i++];
        new GMSListDecoder(lines[i++]).toRealArray(this.item, 13);
        new GMSListDecoder(lines[i++]).toRealArray(this.keyitem, 13);
        new GMSListDecoder(lines[i++]).toRealArray(this.weapon, 13);
        new GMSListDecoder(lines[i++]).toRealArray(this.armor, 13);
        this.tension = +lines[i++]; this.maxtension = +lines[i++]; this.lweapon = +lines[i++]; this.larmor = +lines[i++];
        this.lxp = +lines[i++]; this.llv = +lines[i++]; this.lgold = +lines[i++]; this.lhp = +lines[i++];
        this.lmaxhp = +lines[i++]; this.lat = +lines[i++]; this.ldf = +lines[i++]; this.lwstrength = +lines[i++]; this.ladef = +lines[i++];
        new GMSListDecoder(lines[i++]).toRealArray(this.litem, 8);
        new GMSListDecoder(lines[i++]).toRealArray(this.phone, 8);
        new GMSListDecoder(lines[i++]).toRealArray(this.flag, 9999);
        this.plot = +lines[i++]; this.currentroom = +lines[i++]; this.time = +lines[i++];
    }
    writeConsole() {
        const lines = [];
        const push = v => lines.push(String(v));
        const rl = a => new GMSListEncoder([...a].map(v => ({ type: "real", value: v }))).getString();
        const sl = a => new GMSListEncoder([...a].map(v => ({ type: "string", value: v }))).getString();
        push(this.truename); push(sl(this.othername));
        for (let j = 0; j < 3; j++) push(this.Char[j]);
        push(this.gold); push(this.xp); push(this.lv); push(this.inv); push(this.invc); push(this.darkzone);
        push(rl(this.hp)); push(rl(this.maxhp)); push(rl(this.at)); push(rl(this.df)); push(rl(this.mag));
        push(rl(this.guts)); push(rl(this.charweapon)); push(rl(this.chararmor1)); push(rl(this.chararmor2));
        push(sl(this.weaponstyle));
        for (let ch = 0; ch < 4; ch++) {
            for (let s = 0; s < 4; s++) {
                push(this.itemat[ch][s]); push(this.itemdf[ch][s]); push(this.itemmag[ch][s]); push(this.itembolts[ch][s]);
                push(this.itemgrazeamt[ch][s]); push(this.itemgrazesize[ch][s]); push(this.itemboltspeed[ch][s]); push(this.itemspecial[ch][s]);
            }
            for (let s = 0; s < 12; s++) push(this.spell[ch][s]);
        }
        push(this.boltspeed); push(this.grazeamt); push(this.grazesize);
        push(rl(this.item)); push(rl(this.keyitem)); push(rl(this.weapon)); push(rl(this.armor));
        push(this.tension); push(this.maxtension); push(this.lweapon); push(this.larmor); push(this.lxp); push(this.llv);
        push(this.lgold); push(this.lhp); push(this.lmaxhp); push(this.lat); push(this.ldf); push(this.lwstrength); push(this.ladef);
        push(rl(this.litem)); push(rl(this.phone)); push(rl(this.flag));
        push(this.plot); push(this.currentroom); push(this.time);
        return lines.join("\r\n");
    }
    static isPC(lines) { return lines.length === 10318; }
    static isConsole(lines) { return lines.length === 223; }
}

class DeltaruneCh2 {
    constructor() {
        this.truename = ""; this.othername = new Array(6).fill("");
        this.Char = [0, 0, 0]; this.gold = 0; this.xp = 0; this.lv = 0; this.inv = 0; this.invc = 0; this.darkzone = 0;
        this.hp = [0, 0, 0, 0, 0]; this.maxhp = [0, 0, 0, 0, 0]; this.at = [0, 0, 0, 0, 0]; this.df = [0, 0, 0, 0, 0]; this.mag = [0, 0, 0, 0, 0];
        this.guts = [0, 0, 0, 0, 0]; this.charweapon = [0, 0, 0, 0, 0]; this.chararmor1 = [0, 0, 0, 0, 0]; this.chararmor2 = [0, 0, 0, 0, 0];
        this.weaponstyle = [0, 0, 0, 0, 0];
        this.itemat = Array.from({ length: 5 }, () => [0, 0, 0, 0]); this.itemdf = Array.from({ length: 5 }, () => [0, 0, 0, 0]);
        this.itemmag = Array.from({ length: 5 }, () => [0, 0, 0, 0]); this.itembolts = Array.from({ length: 5 }, () => [0, 0, 0, 0]);
        this.itemgrazeamt = Array.from({ length: 5 }, () => [0, 0, 0, 0]); this.itemgrazesize = Array.from({ length: 5 }, () => [0, 0, 0, 0]);
        this.itemboltspeed = Array.from({ length: 5 }, () => [0, 0, 0, 0]); this.itemspecial = Array.from({ length: 5 }, () => [0, 0, 0, 0]);
        this.itemelement = Array.from({ length: 5 }, () => [0, 0, 0, 0]); this.itemelementamount = Array.from({ length: 5 }, () => [0, 0, 0, 0]);
        this.spell = Array.from({ length: 5 }, () => new Array(12).fill(0));
        this.boltspeed = 0; this.grazeamt = 0; this.grazesize = 0;
        this.item = new Array(13).fill(0); this.keyitem = new Array(13).fill(0);
        this.weapon = new Array(48).fill(0); this.armor = new Array(48).fill(0); this.pocketitem = new Array(72).fill(0);
        this.tension = 0; this.maxtension = 0; this.lweapon = 0; this.larmor = 0; this.lxp = 0; this.llv = 0;
        this.lgold = 0; this.lhp = 0; this.lmaxhp = 0; this.lat = 0; this.ldf = 0; this.lwstrength = 0; this.ladef = 0;
        this.litem = new Array(8).fill(0); this.phone = new Array(8).fill(0);
        this.flag = new Array(2500).fill(0); this.plot = 0; this.currentroom = 0; this.time = 0;
    }
    readPC(lines) {
        let i = 0;
        this.truename = lines[i++];
        for (let j = 0; j < 6; j++) this.othername[j] = lines[i++];
        for (let j = 0; j < 3; j++) this.Char[j] = +lines[i++];
        this.gold = +lines[i++]; this.xp = +lines[i++]; this.lv = +lines[i++]; this.inv = +lines[i++];
        this.invc = +lines[i++]; this.darkzone = +lines[i++];
        for (let ch = 0; ch < 5; ch++) {
            this.hp[ch] = +lines[i++]; this.maxhp[ch] = +lines[i++]; this.at[ch] = +lines[i++];
            this.df[ch] = +lines[i++]; this.mag[ch] = +lines[i++]; this.guts[ch] = +lines[i++];
            this.charweapon[ch] = +lines[i++]; this.chararmor1[ch] = +lines[i++]; this.chararmor2[ch] = +lines[i++];
            this.weaponstyle[ch] = +lines[i++];
            for (let s = 0; s < 4; s++) {
                this.itemat[ch][s] = +lines[i++]; this.itemdf[ch][s] = +lines[i++]; this.itemmag[ch][s] = +lines[i++];
                this.itembolts[ch][s] = +lines[i++]; this.itemgrazeamt[ch][s] = +lines[i++]; this.itemgrazesize[ch][s] = +lines[i++];
                this.itemboltspeed[ch][s] = +lines[i++]; this.itemspecial[ch][s] = +lines[i++];
                this.itemelement[ch][s] = +lines[i++]; this.itemelementamount[ch][s] = +lines[i++];
            }
            for (let s = 0; s < 12; s++) this.spell[ch][s] = +lines[i++];
        }
        this.boltspeed = +lines[i++]; this.grazeamt = +lines[i++]; this.grazesize = +lines[i++];
        for (let j = 0; j < 13; j++) { this.item[j] = +lines[i++]; this.keyitem[j] = +lines[i++]; }
        for (let j = 0; j < 48; j++) { this.weapon[j] = +lines[i++]; this.armor[j] = +lines[i++]; }
        for (let j = 0; j < 72; j++) this.pocketitem[j] = +lines[i++];
        this.tension = +lines[i++]; this.maxtension = +lines[i++]; this.lweapon = +lines[i++]; this.larmor = +lines[i++];
        this.lxp = +lines[i++]; this.llv = +lines[i++]; this.lgold = +lines[i++]; this.lhp = +lines[i++];
        this.lmaxhp = +lines[i++]; this.lat = +lines[i++]; this.ldf = +lines[i++]; this.lwstrength = +lines[i++]; this.ladef = +lines[i++];
        for (let j = 0; j < 8; j++) { this.litem[j] = +lines[i++]; this.phone[j] = +lines[i++]; }
        for (let j = 0; j < 2500; j++) this.flag[j] = +lines[i++];
        this.plot = +lines[i++]; this.currentroom = +lines[i++]; this.time = +lines[i++];
    }
    writePC() {
        const lines = [];
        const push = v => lines.push(String(v));
        push(this.truename);
        for (let j = 0; j < 6; j++) push(this.othername[j]);
        for (let j = 0; j < 3; j++) push(this.Char[j]);
        push(this.gold); push(this.xp); push(this.lv); push(this.inv); push(this.invc); push(this.darkzone);
        for (let ch = 0; ch < 5; ch++) {
            push(this.hp[ch]); push(this.maxhp[ch]); push(this.at[ch]); push(this.df[ch]); push(this.mag[ch]);
            push(this.guts[ch]); push(this.charweapon[ch]); push(this.chararmor1[ch]); push(this.chararmor2[ch]);
            push(this.weaponstyle[ch]);
            for (let s = 0; s < 4; s++) {
                push(this.itemat[ch][s]); push(this.itemdf[ch][s]); push(this.itemmag[ch][s]); push(this.itembolts[ch][s]);
                push(this.itemgrazeamt[ch][s]); push(this.itemgrazesize[ch][s]); push(this.itemboltspeed[ch][s]); push(this.itemspecial[ch][s]);
                push(this.itemelement[ch][s]); push(this.itemelementamount[ch][s]);
            }
            for (let s = 0; s < 12; s++) push(this.spell[ch][s]);
        }
        push(this.boltspeed); push(this.grazeamt); push(this.grazesize);
        for (let j = 0; j < 13; j++) { push(this.item[j]); push(this.keyitem[j]); }
        for (let j = 0; j < 48; j++) { push(this.weapon[j]); push(this.armor[j]); }
        for (let j = 0; j < 72; j++) push(this.pocketitem[j]);
        push(this.tension); push(this.maxtension); push(this.lweapon); push(this.larmor); push(this.lxp); push(this.llv);
        push(this.lgold); push(this.lhp); push(this.lmaxhp); push(this.lat); push(this.ldf); push(this.lwstrength); push(this.ladef);
        for (let j = 0; j < 8; j++) { push(this.litem[j]); push(this.phone[j]); }
        for (let j = 0; j < 2500; j++) push(this.flag[j]);
        push(this.plot); push(this.currentroom); push(this.time);
        return lines.join("\r\n");
    }
    readConsole(lines) {
        let i = 0;
        this.truename = lines[i++];
        new GMSListDecoder(lines[i++]).toStringArray(this.othername, 6);
        for (let j = 0; j < 3; j++) this.Char[j] = +lines[i++];
        this.gold = +lines[i++]; this.xp = +lines[i++]; this.lv = +lines[i++]; this.inv = +lines[i++];
        this.invc = +lines[i++]; this.darkzone = +lines[i++];
        new GMSListDecoder(lines[i++]).toRealArray(this.hp, 5);
        new GMSListDecoder(lines[i++]).toRealArray(this.maxhp, 5);
        new GMSListDecoder(lines[i++]).toRealArray(this.at, 5);
        new GMSListDecoder(lines[i++]).toRealArray(this.df, 5);
        new GMSListDecoder(lines[i++]).toRealArray(this.mag, 5);
        new GMSListDecoder(lines[i++]).toRealArray(this.guts, 5);
        new GMSListDecoder(lines[i++]).toRealArray(this.charweapon, 5);
        new GMSListDecoder(lines[i++]).toRealArray(this.chararmor1, 5);
        new GMSListDecoder(lines[i++]).toRealArray(this.chararmor2, 5);
        new GMSListDecoder(lines[i++]).toRealArray(this.weaponstyle, 5);
        for (let ch = 0; ch < 5; ch++) {
            for (let s = 0; s < 4; s++) {
                this.itemat[ch][s] = +lines[i++]; this.itemdf[ch][s] = +lines[i++]; this.itemmag[ch][s] = +lines[i++];
                this.itembolts[ch][s] = +lines[i++]; this.itemgrazeamt[ch][s] = +lines[i++]; this.itemgrazesize[ch][s] = +lines[i++];
                this.itemboltspeed[ch][s] = +lines[i++]; this.itemspecial[ch][s] = +lines[i++];
                this.itemelement[ch][s] = +lines[i++]; this.itemelementamount[ch][s] = +lines[i++];
            }
            for (let s = 0; s < 12; s++) this.spell[ch][s] = +lines[i++];
        }
        this.boltspeed = +lines[i++]; this.grazeamt = +lines[i++]; this.grazesize = +lines[i++];
        new GMSListDecoder(lines[i++]).toRealArray(this.item, 13);
        new GMSListDecoder(lines[i++]).toRealArray(this.keyitem, 13);
        new GMSListDecoder(lines[i++]).toRealArray(this.weapon, 48);
        new GMSListDecoder(lines[i++]).toRealArray(this.armor, 48);
        new GMSListDecoder(lines[i++]).toRealArray(this.pocketitem, 72);
        this.tension = +lines[i++]; this.maxtension = +lines[i++]; this.lweapon = +lines[i++]; this.larmor = +lines[i++];
        this.lxp = +lines[i++]; this.llv = +lines[i++]; this.lgold = +lines[i++]; this.lhp = +lines[i++];
        this.lmaxhp = +lines[i++]; this.lat = +lines[i++]; this.ldf = +lines[i++]; this.lwstrength = +lines[i++]; this.ladef = +lines[i++];
        new GMSListDecoder(lines[i++]).toRealArray(this.litem, 8);
        new GMSListDecoder(lines[i++]).toRealArray(this.phone, 8);
        new GMSListDecoder(lines[i++]).toRealArray(this.flag, 2500);
        this.plot = +lines[i++]; this.currentroom = +lines[i++]; this.time = +lines[i++];
    }
    writeConsole() {
        const lines = [];
        const push = v => lines.push(String(v));
        const rl = a => new GMSListEncoder([...a].map(v => ({ type: "real", value: v }))).getString();
        const sl = a => new GMSListEncoder([...a].map(v => ({ type: "string", value: v }))).getString();
        push(this.truename); push(sl(this.othername));
        for (let j = 0; j < 3; j++) push(this.Char[j]);
        push(this.gold); push(this.xp); push(this.lv); push(this.inv); push(this.invc); push(this.darkzone);
        push(rl(this.hp)); push(rl(this.maxhp)); push(rl(this.at)); push(rl(this.df)); push(rl(this.mag));
        push(rl(this.guts)); push(rl(this.charweapon)); push(rl(this.chararmor1)); push(rl(this.chararmor2)); push(rl(this.weaponstyle));
        for (let ch = 0; ch < 5; ch++) {
            for (let s = 0; s < 4; s++) {
                push(this.itemat[ch][s]); push(this.itemdf[ch][s]); push(this.itemmag[ch][s]); push(this.itembolts[ch][s]);
                push(this.itemgrazeamt[ch][s]); push(this.itemgrazesize[ch][s]); push(this.itemboltspeed[ch][s]); push(this.itemspecial[ch][s]);
                push(this.itemelement[ch][s]); push(this.itemelementamount[ch][s]);
            }
            for (let s = 0; s < 12; s++) push(this.spell[ch][s]);
        }
        push(this.boltspeed); push(this.grazeamt); push(this.grazesize);
        push(rl(this.item)); push(rl(this.keyitem)); push(rl(this.weapon)); push(rl(this.armor)); push(rl(this.pocketitem));
        push(this.tension); push(this.maxtension); push(this.lweapon); push(this.larmor); push(this.lxp); push(this.llv);
        push(this.lgold); push(this.lhp); push(this.lmaxhp); push(this.lat); push(this.ldf); push(this.lwstrength); push(this.ladef);
        push(rl(this.litem)); push(rl(this.phone)); push(rl(this.flag));
        push(this.plot); push(this.currentroom); push(this.time);
        return lines.join("\r\n");
    }
    static isPC(lines) { return lines.length === 3055; }
    static isConsole(lines) { return lines.length === 308; }
}

function buildIni(files, entries) {
    const sections = {};
    const order = [];
    let status = 0;
    for (const [filename, content] of entries) {
        const lines = content.split(/\r?\n/);
        let save;
        if (filename.startsWith("filech1")) {
            if (!DeltaruneCh1.isPC(lines)) continue;
            save = new DeltaruneCh1(); save.readPC(lines);
            const id = parseInt(filename.replace("filech1_", ""));
            if (id >= 3 && id < 6) status = 1;
            const sec = `G${id}`;
            sections[sec] = {};
            order.push(sec);
            sections[sec]["Name"] = save.truename;
            sections[sec]["Level"] = `"${save.lv}"`;
            sections[sec]["Love"] = `"${save.llv}"`;
            sections[sec]["Time"] = `"${save.time}"`;
            sections[sec]["Date"] = '"0"';
            sections[sec]["Room"] = `"${save.currentroom}"`;
            sections[sec]["InitLang"] = `"${save.flag[912]}"`;
            let ura = 0;
            if (save.flag[241] === 6) ura = 1;
            if (save.flag[241] === 7) ura = 2;
            sections[sec]["UraBoss"] = `"${ura}"`;
            files.log(`  "${save.truename}" ch1 → [${sec}]`);
        } else if (filename.startsWith("filech2")) {
            if (!DeltaruneCh2.isPC(lines)) continue;
            save = new DeltaruneCh2(); save.readPC(lines);
            const id = parseInt(filename.replace("filech2_", ""));
            if (id >= 3 && id < 6) status = 1;
            const sec = `G_2_${id}`;
            sections[sec] = {}; order.push(sec);
            sections[sec]["Name"] = save.truename;
            sections[sec]["Level"] = `"${save.lv}"`; sections[sec]["Love"] = `"${save.llv}"`;
            sections[sec]["Time"] = `"${save.time}"`; sections[sec]["Date"] = '"0"';
            sections[sec]["Room"] = `"${save.currentroom}"`; sections[sec]["InitLang"] = `"${save.flag[912]}"`;
            sections[sec]["UraBoss"] = `"${save.flag[571] | 0}"`;
            files.log(`  "${save.truename}" ch2 → [${sec}]`);
        } else if (filename.startsWith("filech3")) {
            if (!DeltaruneCh2.isPC(lines)) continue;
            save = new DeltaruneCh2(); save.readPC(lines);
            const id = parseInt(filename.replace("filech3_", ""));
            if (id >= 3 && id < 6) status = 1;
            const sec = `G_3_${id}`; sections[sec] = {}; order.push(sec);
            sections[sec]["Name"] = save.truename; sections[sec]["Level"] = `"${save.lv}"`;
            sections[sec]["Love"] = `"${save.llv}"`; sections[sec]["Time"] = `"${save.time}"`;
            sections[sec]["Date"] = '"0"'; sections[sec]["Room"] = `"${save.currentroom}"`;
            sections[sec]["InitLang"] = `"${save.flag[912]}"`; sections[sec]["UraBoss"] = `"${save.flag[1047] | 0}"`;
            files.log(`  "${save.truename}" ch3 → [${sec}]`);
        } else if (filename.startsWith("filech4")) {
            if (!DeltaruneCh2.isPC(lines)) continue;
            save = new DeltaruneCh2(); save.readPC(lines);
            const id = parseInt(filename.replace("filech4_", ""));
            if (id >= 3 && id < 6) status = 1;
            const sec = `G_4_${id}`; sections[sec] = {}; order.push(sec);
            sections[sec]["Name"] = save.truename; sections[sec]["Level"] = `"${save.lv}"`;
            sections[sec]["Love"] = `"${save.llv}"`; sections[sec]["Time"] = `"${save.time}"`;
            sections[sec]["Date"] = '"0"'; sections[sec]["Room"] = `"${save.currentroom}"`;
            sections[sec]["InitLang"] = `"${save.flag[912]}"`; sections[sec]["UraBoss"] = `"${save.flag[1629] | 0}"`;
            files.log(`  "${save.truename}" ch4 → [${sec}]`);
        }
    }
    sections["STATUS"] = { "STATUS": `"${status}"` };
    order.push("STATUS");
    let ini = "";
    for (const sec of order) {
        ini += `[${sec}]\n`;
        for (const [k, v] of Object.entries(sections[sec])) ini += `${k}=${v}\n`;
    }
    return ini;
}

const els = id => document.getElementById(id);
const log = (el, msg, cls = "") => {
    el.style.display = "block";
    el.innerHTML += `<span class="${cls}">${msg}</span>\n`;
    el.scrollTop = el.scrollHeight;
};
const clearLog = el => { el.innerHTML = ""; el.style.display = "none"; };

function readFile(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsText(file);
    });
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsArrayBuffer(file);
    });
}

function download(filename, content, mime = "application/octet-stream") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function downloadZip(files, zipName = "converted.zip") {
    const zip = new JSZip();
    for (const [name, content] of files) zip.file(name, content);
    const blob = await zip.generateAsync({ type: "blob" });
    download(zipName, blob);
}

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".mode-content").forEach(m => m.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.target).classList.add("active");
    });
});

const c2pFile = els("c2p-file");
const c2pLog = els("c2p-log");
let c2pSavData = null;

c2pFile.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    els("c2p-label").textContent = file.name;
    els("c2p-upload").classList.add("has-files");
    els("c2p-convert").disabled = false;
    c2pSavData = await readFile(file);
});

els("c2p-convert").addEventListener("click", async () => {
    if (!c2pSavData) return;
    clearLog(c2pLog);
    els("c2p-download").classList.add("hidden");
    try {
        const data = SAVFormat.extract(c2pSavData);
        const entries = Object.entries(data).filter(([k]) => k !== "default");
        log(c2pLog, `Extracted ${entries.length} files from SAV.`);
        const results = [];
        for (const [name, content] of entries) {
            const lines = content.split(/\r?\n/);
            if (name.startsWith("filech1") && DeltaruneCh1.isConsole(lines)) {
                const save = new DeltaruneCh1();
                try {
                    save.readConsole(lines);
                    results.push([name, save.writePC()]);
                    log(c2pLog, `  Converted ${name} (${save.truename})`, "info");
                } catch (e) { log(c2pLog, `  ${name}: error - ${e.message}`, "error"); }
            } else if ((name.startsWith("filech2") || name.startsWith("filech3") || name.startsWith("filech4")) && DeltaruneCh2.isConsole(lines)) {
                const save = new DeltaruneCh2();
                try {
                    save.readConsole(lines);
                    results.push([name, save.writePC()]);
                    log(c2pLog, `  Converted ${name} (${save.truename})`, "info");
                } catch (e) { log(c2pLog, `  ${name}: error - ${e.message}`, "error"); }
            } else {
                results.push([name, content]);
                log(c2pLog, `  Copied ${name}`, "");
            }
        }
        log(c2pLog, `Done. ${results.length} files ready.`);
        els("c2p-download").classList.remove("hidden");
        els("c2p-download").onclick = () => downloadZip(results, "pcsave.zip");
    } catch (e) {
        log(c2pLog, `Error: ${e.message}`, "error");
    }
});

const p2cFiles = els("p2c-files");
const p2cLog = els("p2c-log");
let p2cFileList = [];

p2cFiles.addEventListener("change", e => {
    p2cFileList = Array.from(e.target.files);
    if (p2cFileList.length === 0) return;
    els("p2c-label").textContent = `${p2cFileList.length} files selected`;
    const names = p2cFileList.map(f => f.name).sort();
    els("p2c-filelist").innerHTML = `<span>${names.join("</span><span>")}</span>`;
    els("p2c-upload").classList.add("has-files");
    els("p2c-convert").disabled = false;
});

els("p2c-convert").addEventListener("click", async () => {
    if (p2cFileList.length === 0) return;
    clearLog(p2cLog);
    els("p2c-download").classList.add("hidden");
    try {
        const outData = {};
        for (const file of p2cFileList) {
            const content = await readFile(file);
            const lines = content.split(/\r?\n/);
            const name = file.name;
            if (name.startsWith("filech1")) {
                const save = new DeltaruneCh1();
                try {
                    save.readPC(lines);
                    outData[name] = save.writeConsole();
                    log(p2cLog, `  Converted ${name} (${save.truename})`, "info");
                } catch (e) { log(p2cLog, `  ${name}: error - ${e.message}`, "error"); return; }
            } else if (name.startsWith("filech2") || name.startsWith("filech3") || name.startsWith("filech4")) {
                const save = new DeltaruneCh2();
                try {
                    save.readPC(lines);
                    outData[name] = save.writeConsole();
                    log(p2cLog, `  Converted ${name} (${save.truename})`, "info");
                } catch (e) { log(p2cLog, `  ${name}: error - ${e.message}`, "error"); return; }
            } else {
                outData[name] = content;
                log(p2cLog, `  Copied ${name}`, "");
            }
        }
        const savText = SAVFormat.pack(outData);
        log(p2cLog, `Done. Packed ${Object.keys(outData).length} files.`);
        els("p2c-download").classList.remove("hidden");
        els("p2c-download").onclick = () => download("deltarune.sav", savText, "application/json");
    } catch (e) {
        log(p2cLog, `Error: ${e.message}`, "error");
    }
});

const toolFile = els("tool-file");
const toolLog = els("tool-log");
let toolFileData = null;

toolFile.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    toolFileData = { name: file.name, content: await readFile(file) };
    els("tool-label").textContent = file.name;
    els("tool-upload").classList.add("has-files");
    els("tool-convert").disabled = false;
});

els("tool-convert").addEventListener("click", async () => {
    if (!toolFileData) return;
    clearLog(toolLog);
    els("tool-download").classList.add("hidden");
    const dir = els("tool-direction").value;
    const lines = toolFileData.content.split(/\r?\n/);
    try {
        let result, outName;
        if (dir === "console2pc") {
            const isCh1 = DeltaruneCh1.isConsole(lines);
            const isCh2 = DeltaruneCh2.isConsole(lines);
            if (isCh1) {
                const save = new DeltaruneCh1(); save.readConsole(lines);
                result = save.writePC(); outName = toolFileData.name + "_pc";
                log(toolLog, `Converted Ch1 console → PC (${save.truename})`, "info");
            } else if (isCh2) {
                const save = new DeltaruneCh2(); save.readConsole(lines);
                result = save.writePC(); outName = toolFileData.name + "_pc";
                log(toolLog, `Converted Ch2 console → PC (${save.truename})`, "info");
            } else {
                throw new Error("Unknown save format");
            }
        } else {
            const isCh1 = DeltaruneCh1.isPC(lines);
            const isCh2 = DeltaruneCh2.isPC(lines);
            if (isCh1) {
                const save = new DeltaruneCh1(); save.readPC(lines);
                result = save.writeConsole(); outName = toolFileData.name + "_console";
                log(toolLog, `Converted Ch1 PC → console (${save.truename})`, "info");
            } else if (isCh2) {
                const save = new DeltaruneCh2(); save.readPC(lines);
                result = save.writeConsole(); outName = toolFileData.name + "_console";
                log(toolLog, `Converted Ch2 PC → console (${save.truename})`, "info");
            } else {
                throw new Error("Unknown save format");
            }
        }
        els("tool-download").classList.remove("hidden");
        els("tool-download").onclick = () => download(outName, result);
    } catch (e) { log(toolLog, `Error: ${e.message}`, "error"); }
});

const toolSavFile = els("tool-sav-file");
const toolSavLog = els("tool-sav-log");
let toolSavData = null;
let toolSavFiles = [];

toolSavFile.addEventListener("change", e => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (files.length === 1 && files[0].name.endsWith(".sav")) {
        toolSavData = null; toolSavFiles = [];
        readFile(files[0]).then(d => { toolSavData = d; });
        els("tool-sav-label").textContent = files[0].name;
        els("tool-sav-filelist").innerHTML = "";
        els("tool-extract-sav").disabled = false;
        els("tool-pack-sav").disabled = true;
        els("tool-sav-extra").classList.add("hidden");
    } else {
        toolSavFiles = files; toolSavData = null;
        els("tool-sav-label").textContent = `${files.length} files`;
        const names = files.map(f => f.name).sort();
        els("tool-sav-filelist").innerHTML = `<span>${names.join("</span><span>")}</span>`;
        els("tool-pack-sav").disabled = false;
        els("tool-extract-sav").disabled = true;
        els("tool-sav-extra").classList.remove("hidden");
    }
    els("tool-sav-upload").classList.add("has-files");
});

els("tool-extract-sav").addEventListener("click", async () => {
    if (!toolSavData) return;
    clearLog(toolSavLog);
    try {
        const data = SAVFormat.extract(toolSavData);
        const entries = Object.entries(data).filter(([k]) => k !== "default");
        log(toolSavLog, `Extracted ${entries.length} files.`);
        await downloadZip(entries, "extracted.zip");
        log(toolSavLog, "Downloaded as extracted.zip", "info");
    } catch (e) { log(toolSavLog, `Error: ${e.message}`, "error"); }
});

els("tool-pack-sav").addEventListener("click", async () => {
    if (toolSavFiles.length === 0) return;
    clearLog(toolSavLog);
    try {
        const outData = {};
        for (const file of toolSavFiles) {
            outData[file.name] = await readFile(file);
        }
        const savText = SAVFormat.pack(outData);
        const name = els("tool-sav-name").value || "deltarune.sav";
        download(name, savText, "application/json");
        log(toolSavLog, `Packed ${Object.keys(outData).length} files into ${name}`, "info");
    } catch (e) { log(toolSavLog, `Error: ${e.message}`, "error"); }
});

const iniFiles = els("ini-files");
const iniLog = els("ini-log");
let iniFileList = [];

iniFiles.addEventListener("change", e => {
    iniFileList = Array.from(e.target.files);
    if (iniFileList.length === 0) return;
    els("ini-label").textContent = `${iniFileList.length} files selected`;
    const names = iniFileList.map(f => f.name).sort().filter(n => n.startsWith("filech"));
    els("ini-filelist").innerHTML = `<span>${names.join("</span><span>")}</span>`;
    els("ini-upload").classList.add("has-files");
    els("ini-convert").disabled = false;
});

els("ini-convert").addEventListener("click", async () => {
    if (iniFileList.length === 0) return;
    clearLog(iniLog);
    els("ini-download").classList.add("hidden");
    try {
        const entries = [];
        for (const file of iniFileList) {
            const content = await readFile(file);
            entries.push([file.name, content]);
        }
        const files = { log: (msg) => log(iniLog, msg, "") };
        const ini = buildIni(files, entries);
        log(iniLog, "INI file built.", "info");
        els("ini-download").classList.remove("hidden");
        els("ini-download").onclick = () => download("deltarune.ini", ini, "text/plain");
    } catch (e) { log(iniLog, `Error: ${e.message}`, "error"); }
});