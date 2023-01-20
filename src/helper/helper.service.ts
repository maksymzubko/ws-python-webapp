import {Injectable} from '@nestjs/common';

@Injectable()
export class HelperService {
    makeid(length, onlyNums = false) {
        var result = '';
        var characters = '';
        if (!onlyNums) characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        else characters = '0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    getRandomInt(max) {
        return Math.floor(Math.random() * max);
    }

    IsChildColor(color, parent){
        const colorPallete = {
            "red": [
                "red",
                "crimson",
                "indian red",
                "light coral",
                "dark salmon",
                "salmon",
                "light salmon",
                "orange red"
            ],
            "blue": [
                "blue",
                "midnight blue",
                "navy",
                "dark blue",
                "medium blue",
                "royal blue"
            ],
            "black": [
                "black"
            ],
            "white": [
                "white",
                "white smoke",
                "floral white",
                "alice blue",
                "ghost white",
                "honeydew",
                "ivory",
                "azure",
                "snow",
                "corn silk",
                "lemon chiffon",
                "light golden rod yellow",
                "light yellow"
            ],
            "yellow": [
                "yellow",
                "gold",
                "dark golden rod",
                "golden rod",
                "pale golden rod",
                "dark khaki",
                "khaki",
                "moccasin",
                "navajo white",
                "peach puff",
                "papaya whip"
            ],
            "green": [
                "green",
                "yellow green",
                "dark olive green",
                "olive drab",
                "dark green",
                "forest green",
                "dark sea green",
                "sea green",
                "medium aqua marine",
                "medium sea green"
            ],
            "orange": [
                "orange",
                "sandy brown",
                "dark orange",
                "coral",
                "chocolate",
                "tomato"
            ],
            "pink": [
                "pink",
                "plum",
                "violet",
                "magenta",
                "fuchsia",
                "orchid",
                "medium violet red",
                "pale violet red",
                "deep pink",
                "hot pink",
                "light pink"
            ],
            "purple": [
                "purple",
                "blue violet",
                "indigo",
                "dark slate blue",
                "slate blue",
                "medium slate blue",
                "medium purple",
                "dark magenta",
                "dark violet",
                "dark orchid",
                "medium orchid"
            ],
            "cyan": [
                "cyan",
                "teal",
                "dark cyan",
                "aqua",
                "light cyan",
                "pale turquoise",
                "powder blue",
                "cadet blue",
                "steel blue",
                "corn flower blue",
                "deep sky blue",
                "dodger blue",
                "light blue",
                "sky blue",
                "light sky blue"
            ],
            "teal": [
                "aqua marine",
                "medium aqua marine",
                "turquoise",
                "medium turquoise",
                "dark turquoise"
            ],
            "gray": [
                "gray",
                "grey",
                "slate gray",
                "light slate gray",
                "light steel blue",
                "dark gray",
                "dark grey",
                "silver",
                "light gray",
                "light grey",
                "gainsboro"
            ],
            "maroon": [
                "maroon",
                "dark red",
                "firebrick"
            ],
            "brown": [
                "brown",
                "saddle brown",
                "sienna",
                "peru"
            ],
            "lime": [
                "lime",
                "lawn green",
                "chartreuse",
                "green yellow",
                "lime green",
                "light green",
                "pale green",
                "medium spring green",
                "spring green"
            ]
        }

        const _p = colorPallete[parent];
        return _p.includes(color);
    }
}
