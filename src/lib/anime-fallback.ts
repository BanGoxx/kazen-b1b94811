import type { MediaItem, MediaDetail } from "./media-types";

type AnimeFallbackKind = "trending" | "popular" | "upcoming" | "seasonal";

function anime(
  id: number,
  title: string,
  titleOriginal: string,
  score: number | null,
  status: MediaItem["status"],
  releaseDate: string | null,
  posterUrl: string,
  genres: string[],
): MediaItem {
  return {
    key: `anilist:${id}`,
    source: "anilist",
    externalId: String(id),
    mediaType: "anime",
    title,
    titleOriginal,
    synopsis: null,
    posterUrl,
    backdropUrl: null,
    genres,
    score,
    status,
    releaseDate,
    nextEpisode: null,
    episodesCount: null,
    seasonsCount: null,
    runtime: null,
    platforms: [],
  };
}

const TRENDING: MediaItem[] = [
  anime(182205, "That Time I Got Reincarnated as a Slime Season 4", "転生したらスライムだった件 第4期", 82, "en_cours", "2026-04-03", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx182205-q2AeO1owuQbO.jpg", ["Action", "Aventure", "Comédie", "Fantastique"]),
  anime(199748, "I Became a Legend After My 10 Year-Long Last Stand", "ここは俺に任せて先に行けと言ってから１０年がたったら伝説になっていた。", 66, "en_cours", "2026-07-03", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx199748-PAFk9pGSUmFL.png", ["Action", "Aventure", "Fantastique"]),
  anime(209983, "HELL MODE: The Hardcore Gamer Dominates in Another World with Garbage Balancing Season 2", "ヘルモード 2nd Season", 71, "en_cours", "2026-07-04", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx209983-sFOcKyqMufxb.jpg", ["Action", "Aventure", "Fantastique"]),
  anime(196218, "The Frontier Lord Begins with Zero Subjects", "領民0人スタートの辺境領主様", 68, "en_cours", "2026-07-03", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx196218-UsdTTCrwpDIN.jpg", ["Action", "Comédie", "Drame", "Fantastique"]),
  anime(21, "ONE PIECE", "ONE PIECE", 87, "en_cours", "1999-10-20", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-ELSYx3yMPcKM.jpg", ["Action", "Aventure", "Comédie", "Drame"]),
  anime(196187, "Smoking Behind the Supermarket with You", "スーパーの裏でヤニ吸うふたり", 83, "en_cours", "2026-07-09", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx196187-0dgFi2CPp3xn.jpg", ["Comédie", "Romance", "Tranche de vie"]),
  anime(269, "Bleach", "BLEACH", 79, "termine", "2004-10-05", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx269-d2GmRkJbMopq.png", ["Action", "Aventure", "Surnaturel"]),
  anime(207141, "Chainsmoker Cat", "ヤニねこ", 67, "en_cours", "2026-07-03", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx207141-h5q5KJPd6vaX.jpg", ["Comédie", "Tranche de vie"]),
  anime(180136, "The Exiled Heavy Knight Knows How to Game the System", "追放された転生重騎士はゲーム知識で無双する", 68, "en_cours", "2026-07-03", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx180136-gtMTCRlOD4OE.jpg", ["Action", "Fantastique"]),
  anime(204466, "KAIJU GIRL CARAMELISE", "乙女怪獣キャラメリゼ", 75, "en_cours", "2026-07-03", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx204466-vXMvIs4VOoQd.png", ["Comédie", "Romance", "Surnaturel"]),
  anime(208044, "From Overshadowed to Overpowered", "落第賢者の学院無双", 66, "en_cours", "2026-06-26", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx208044-Pm2UhvApQFUh.jpg", ["Action", "Aventure", "Fantastique"]),
  anime(178789, "Mushoku Tensei: Jobless Reincarnation Season 3", "無職転生Ⅲ", 86, "en_cours", "2026-07-04", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx178789-hNXjKFzUq7mk.jpg", ["Aventure", "Drame", "Fantastique"]),
];

const POPULAR: MediaItem[] = [
  anime(16498, "Attack on Titan", "進撃の巨人", 85, "termine", "2013-04-07", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg", ["Action", "Drame", "Fantastique", "Mystère"]),
  anime(101922, "Demon Slayer: Kimetsu no Yaiba", "鬼滅の刃", 83, "termine", "2019-04-06", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg", ["Action", "Aventure", "Drame", "Fantastique"]),
  anime(113415, "JUJUTSU KAISEN", "呪術廻戦", 84, "termine", "2020-10-03", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-LHBAeoZDIsnF.jpg", ["Action", "Drame", "Surnaturel"]),
  anime(1535, "Death Note", "DEATH NOTE", 84, "termine", "2006-10-04", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-kUgkcrfOrkUM.jpg", ["Mystère", "Psychologique", "Thriller"]),
  anime(21459, "My Hero Academia", "僕のヒーローアカデミア", 77, "termine", "2016-04-03", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21459-nYh85uj2Fuwr.jpg", ["Action", "Aventure", "Comédie"]),
  anime(11061, "Hunter x Hunter (2011)", "HUNTER×HUNTER (2011)", 89, "termine", "2011-10-02", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11061-y5gsT1hoHuHw.png", ["Action", "Aventure", "Fantastique"]),
  anime(21087, "One-Punch Man", "ワンパンマン", 83, "termine", "2015-10-05", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21087-B5DHjqZ3kW4b.jpg", ["Action", "Comédie", "Science-Fiction"]),
  anime(20605, "Tokyo Ghoul", "東京喰種", 76, "termine", "2014-07-04", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/b20605-k665mVkSug8D.jpg", ["Action", "Drame", "Horreur", "Mystère"]),
  anime(20958, "Attack on Titan Season 2", "進撃の巨人 Season２", 85, "termine", "2017-04-01", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20958-HuFJyr54Mmir.jpg", ["Action", "Drame", "Fantastique"]),
  anime(5114, "Fullmetal Alchemist: Brotherhood", "鋼の錬金術師 FULLMETAL ALCHEMIST", 90, "termine", "2009-04-05", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5114-nSWCgQlmOMtj.jpg", ["Action", "Aventure", "Drame", "Fantastique"]),
  anime(20, "Naruto", "NARUTO -ナルト-", 80, "termine", "2002-10-03", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20-dE6UHbFFg1A5.jpg", ["Action", "Aventure", "Comédie"]),
  anime(1735, "NARUTO: Shippuden", "NARUTO -ナルト- 疾風伝", 82, "termine", "2007-02-15", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1735-VF0RQy1XcKZf.jpg", ["Action", "Aventure", "Drame"]),
];

const UPCOMING: MediaItem[] = [
  anime(185874, "BLEACH: Thousand-Year Blood War - The Calamity", "BLEACH 千年血戦篇-禍進譚-", null, "a_venir", "2026-07-25", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx185874-aU3e6tBT6wwA.jpg", ["Action", "Aventure", "Surnaturel"]),
  anime(133007, "Puella Magi Madoka Magica the Movie -Walpurgisnacht: Rising-", "劇場版 魔法少女まどか☆マギカ", null, "a_venir", "2026-08-28", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx133007-5gOUXDvzxy9S.jpg", ["Magical Girl"]),
  anime(195516, "The Apothecary Diaries Season 3", "薬屋のひとりごと 第3期", null, "a_venir", "2026-10-01", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx195516-FWHIFQMvCjVj.jpg", ["Drame", "Mystère"]),
  anime(195604, "Black Clover Season 2", "ブラッククローバー 第2期", null, "a_venir", "2026-10-01", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx195604-BjvWdT5jOcM6.jpg", ["Action", "Aventure", "Fantastique"]),
  anime(171952, "Kage no Jitsuryokusha ni Naritakute!: Zankyou-hen", "劇場版 陰の実力者になりたくて！", null, "a_venir", "2027-01-01", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx171952-uB8CTTCBI1u5.jpg", ["Action", "Comédie", "Fantastique"]),
  anime(181641, "Alya Sometimes Hides Her Feelings in Russian Season 2", "時々ボソッとロシア語でデレる隣のアーリャさん Season 2", null, "a_venir", "2027-01-01", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx181641-XPV9xFwWjvu9.jpg", ["Comédie", "Romance", "Tranche de vie"]),
  anime(198966, "Dandadan 3rd Season", "ダンダダン 第3期", null, "a_venir", "2027-01-01", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx198966-9Ji1GwIyRiiu.jpg", ["Action", "Comédie", "Fantastique"]),
  anime(178031, "Delicious in Dungeon Season 2", "ダンジョン飯 第２期", null, "a_venir", "2027-10-01", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx178031-XNWYP6Qf18bB.png", ["Aventure", "Comédie", "Fantastique"]),
  anime(195539, "Cyberpunk: Edgerunners 2", "サイバーパンク: エッジランナーズ2", null, "a_venir", "2026-01-01", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx195539-jaarfaxv6K0Z.jpg", ["Action", "Drame", "Science-Fiction"]),
  anime(186712, "Bocchi the Rock! 2nd Season", "ぼっち・ざ・ろっく！ 2期", null, "a_venir", null, "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx186712-d5I2TjUQcHuI.jpg", ["Comédie", "Musique", "Tranche de vie"]),
  anime(209939, "Frieren: Beyond Journey's End Season 3", "葬送のフリーレン 第3期", null, "a_venir", "2027-10-01", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx209939-g2Njkml1rheG.jpg", ["Aventure", "Drame", "Fantastique"]),
  anime(159042, "Reincarnated as a Sword Season 2", "転生したら剣でした 第2期", null, "a_venir", "2026-10-01", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx159042-jgPJHpMfrSv5.jpg", ["Action", "Aventure", "Fantastique"]),
];

const SEASONAL: MediaItem[] = [
  anime(178789, "Mushoku Tensei: Jobless Reincarnation Season 3", "無職転生Ⅲ", 86, "en_cours", "2026-07-04", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx178789-hNXjKFzUq7mk.jpg", ["Aventure", "Drame", "Fantastique"]),
  anime(196187, "Smoking Behind the Supermarket with You", "スーパーの裏でヤニ吸うふたり", 83, "en_cours", "2026-07-09", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx196187-0dgFi2CPp3xn.jpg", ["Comédie", "Romance", "Tranche de vie"]),
  anime(135865, "Saga of Tanya the Evil Season 2", "幼女戦記Ⅱ", 81, "en_cours", "2026-07-08", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx135865-T7XIPMAbqcxN.png", ["Action", "Fantastique"]),
  ...UPCOMING.slice(0, 4),
  anime(207141, "Chainsmoker Cat", "ヤニねこ", 67, "en_cours", "2026-07-03", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx207141-h5q5KJPd6vaX.jpg", ["Comédie", "Tranche de vie"]),
  anime(210031, "You and I Are Polar Opposites Season 2", "正反対な君と僕 第2期", 81, "en_cours", "2026-07-05", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx210031-TppgcHZh46LY.jpg", ["Comédie", "Romance"]),
  anime(187260, "I Want to Love You Till Your Dying Day", "きみが死ぬまで恋をしたい", 75, "en_cours", "2026-07-07", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx187260-WW5RBa5NINRP.jpg", ["Drame", "Romance"]),
  anime(187538, "BLACK TORCH", "BLACK TORCH", 72, "en_cours", "2026-07-04", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx187538-fXVXKYUA3VV6.jpg", ["Action", "Surnaturel"]),
  anime(103303, "Sparks of Tomorrow", "あした世界が終わるとしても", 75, "en_cours", "2026-07-05", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx103303-IF43hFJPPv2Y.png", ["Drame", "Science-Fiction"]),
];

const FALLBACKS: Record<AnimeFallbackKind, MediaItem[]> = {
  trending: TRENDING,
  popular: POPULAR,
  upcoming: UPCOMING,
  seasonal: SEASONAL,
};

export function fallbackAnime(kind: AnimeFallbackKind, limit = 24): MediaItem[] {
  return FALLBACKS[kind].slice(0, limit).map((item) => ({ ...item, platforms: [...item.platforms] }));
}

export function fallbackSeasonalAnime(limit = 50): { items: MediaItem[]; season: string; year: number; label: string } {
  return { items: fallbackAnime("seasonal", limit), season: "SUMMER", year: 2026, label: "Été" };
}

export function fallbackAnimePage(kind: string, page: number, perPage = 30) {
  const source = kind === "popular" ? POPULAR : kind === "upcoming" ? UPCOMING : TRENDING;
  if (page > 1) return { items: [], page, hasMore: false };
  return { items: source.slice(0, perPage), page, hasMore: false };
}