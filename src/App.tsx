import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { onValue, ref, set } from "firebase/database";
import { db } from "./firebase";
import "./App.css";

type GameStatus =
  | "idle"
  | "question"
  | "yes"
  | "no"
  | "identified"
  | "timeout"
  | "reveal"
  | "result";

type CandidateResult = {
  candidate: number;
  candidateName: string;
  identified: boolean;
  stoppingQuestion: number;
  time: number;
};

type AyahData = {
  candidateName: string;
  surah: string;
  ayahNumber: string;
  arabic: string;
  translation: string;
};

type GameState = {
  status: GameStatus;

  candidateIndex: number;
  attempt: number;

  elapsed: number;
  startedAt: number | null;

  feedback: "yes" | "no" | null;

  ayahIdentified: boolean;

  completed: boolean;

  stoppingQuestion: number | null;

  result: CandidateResult | null;

  results: CandidateResult[];

  /* AUDIO */

  audioEnabled: boolean;
  musicPlaying: boolean;
  musicVolume: number;
};

const MAX_QUESTIONS = 15;
const MAX_TIME = 240;
const TOTAL_CANDIDATES = 8;

const initialGame: GameState = {
  status: "idle",

  candidateIndex: 1,

  attempt: 1,

  elapsed: 0,

  startedAt: null,

  feedback: null,

  ayahIdentified: false,

  completed: false,

  stoppingQuestion: null,

  result: null,

  results: [],

  audioEnabled: false,

  musicPlaying: false,

  musicVolume: 0.35,
};

const createInitialAyahs = (): AyahData[] =>
  Array.from(
    { length: TOTAL_CANDIDATES },
    () => ({
      candidateName: "",
      surah: "",
      ayahNumber: "",
      arabic: "",
      translation: "",
    })
  );


/* =========================================================
   FIREBASE REALTIME ROOM
========================================================= */

// Keep this identical on the moderator and LED devices.
// We will secure this room before the real event.
const ROOM_ID = "quriverse-event-01";
const gameRef = ref(db, `rooms/${ROOM_ID}/game`);
const ayahsRef = ref(db, `rooms/${ROOM_ID}/ayahs`);
const connectionRef = ref(db, ".info/connected");


/* =========================================================
   APP ROUTER
========================================================= */

function App() {
  const path = window.location.pathname;

  if (path === "/setup") {
    return <SetupPage />;
  }

  return (
    <GamePage
      isLED={path === "/led"}
    />
  );
}


/* =========================================================
   SETUP PAGE
========================================================= */

function SetupPage() {
  const [ayahs, setAyahs] =
    useState<AyahData[]>(() => {
      try {
        const saved =
          localStorage.getItem(
            "quriverse-ayah-data"
          );

        if (saved) {
          const parsed = JSON.parse(saved);

          if (
            Array.isArray(parsed) &&
            parsed.length ===
              TOTAL_CANDIDATES
          ) {
            return parsed;
          }
        }
      } catch {
        // Ignore invalid data.
      }

      return createInitialAyahs();
    });

  const [saved, setSaved] =
    useState(false);

  useEffect(() => {
    const unsubscribe = onValue(ayahsRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const value = snapshot.val();
      const next = Array.isArray(value)
        ? value
        : Object.keys(value)
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => value[key]);

      if (next.length === TOTAL_CANDIDATES) {
        setAyahs(next);
        localStorage.setItem(
          "quriverse-ayah-data",
          JSON.stringify(next)
        );
      }
    });

    return unsubscribe;
  }, []);


  const updateAyah = (
    candidateIndex: number,
    field: keyof AyahData,
    value: string
  ) => {
    setAyahs((current) =>
      current.map((ayah, index) =>
        index === candidateIndex
          ? {
              ...ayah,
              [field]: value,
            }
          : ayah
      )
    );

    setSaved(false);
  };


  const saveSetup = async () => {
    try {
      await set(ayahsRef, ayahs);
      localStorage.setItem(
        "quriverse-ayah-data",
        JSON.stringify(ayahs)
      );
      setSaved(true);
    } catch (error) {
      console.error("Failed to save Ayah setup:", error);
      window.alert("Could not save Ayah setup to Firebase. Check your database rules and internet connection.");
    }

    window.setTimeout(() => {
      setSaved(false);
    }, 2500);
  };


  const clearSetup = () => {
    const confirmed =
      window.confirm(
        "Clear all 8 Ayah entries?"
      );

    if (!confirmed) return;

    const empty =
      createInitialAyahs();

    setAyahs(empty);

    localStorage.removeItem(
      "quriverse-ayah-data"
    );

    set(ayahsRef, empty).catch((error) =>
      console.error("Failed to clear Firebase Ayahs:", error)
    );

    setSaved(false);
  };


  return (
    <div className="app setup-screen">

      <header className="setup-header">

        <div>
          <div className="brand">
            QURIVERSE
          </div>

          <div className="setup-heading">
            AYAH SETUP
          </div>
        </div>


        <div className="setup-header-actions">
          <button
            type="button"
            className="event-restart-top-button"
            onClick={async () => {
              const confirmed = window.confirm(
                "Restart the event from Candidate 1? Current game results will be cleared. Ayah setup will remain."
              );
              if (!confirmed) return;
              await set(gameRef, initialGame);
            }}
          >
            ↻ RESTART EVENT
          </button>

          <a
            href="/"
            className="back-link"
          >
            ← LIVE MODERATOR
          </a>
        </div>

      </header>


      <main className="setup-main">

        <div className="setup-intro">

          <div className="setup-kicker">
            EVENT CONFIGURATION
          </div>

          <h1>
            Hidden Ayahs
          </h1>

          <p>
            Assign one hidden Ayah to
            each candidate. The Ayahs
            remain hidden during the
            game and appear only after
            <strong>
              {" "}REVEAL ANSWER
            </strong>.
          </p>

        </div>


        <div className="ayah-grid">

          {ayahs.map(
            (ayah, index) => (
              <section
                className="ayah-card"
                key={index}
              >

                <div className="ayah-card-header">

                  <div>

                    <div className="candidate-label-small">
                      CANDIDATE
                    </div>

                    <div className="candidate-large">
                      {String(
                        index + 1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </div>

                  </div>


                  <div className="ayah-card-number">
                    AYAH{" "}
                    {index + 1}
                  </div>

                </div>


                <div className="field">

                  <label>
                    CANDIDATE NAME
                  </label>

                  <input
                    type="text"
                    value={ayah.candidateName}
                    onChange={(event) =>
                      updateAyah(
                        index,
                        "candidateName",
                        event.target.value
                      )
                    }
                    placeholder={`Candidate ${index + 1} name`}
                  />

                </div>


                <div className="field">

                  <label>
                    SURAH
                  </label>

                  <input
                    type="text"
                    value={
                      ayah.surah
                    }
                    onChange={(event) =>
                      updateAyah(
                        index,
                        "surah",
                        event.target.value
                      )
                    }
                    placeholder="e.g. Al-Kahf"
                  />

                </div>


                <div className="field">

                  <label>
                    AYAH NUMBER
                  </label>

                  <input
                    type="text"
                    value={
                      ayah.ayahNumber
                    }
                    onChange={(event) =>
                      updateAyah(
                        index,
                        "ayahNumber",
                        event.target.value
                      )
                    }
                    placeholder="e.g. 10"
                  />

                </div>


                <div className="field">

                  <label>
                    ARABIC AYAH
                  </label>

                  <textarea
                    dir="rtl"
                    value={
                      ayah.arabic
                    }
                    onChange={(event) =>
                      updateAyah(
                        index,
                        "arabic",
                        event.target.value
                      )
                    }
                    placeholder="Enter Arabic Ayah..."
                    rows={4}
                  />

                </div>


                <div className="field">

                  <label>
                    ENGLISH TRANSLATION
                  </label>

                  <textarea
                    value={
                      ayah.translation
                    }
                    onChange={(event) =>
                      updateAyah(
                        index,
                        "translation",
                        event.target.value
                      )
                    }
                    placeholder="Enter English translation..."
                    rows={3}
                  />

                </div>

              </section>
            )
          )}

        </div>


        <div className="setup-actions">

          <button
            className="clear-button"
            onClick={clearSetup}
          >
            CLEAR ALL
          </button>


          <button
            className="save-button"
            onClick={saveSetup}
          >
            {saved
              ? "✓ SETUP SAVED"
              : "SAVE AYAH SETUP"}
          </button>

        </div>


        <div className="setup-warning">

          <strong>
            IMPORTANT
          </strong>

          <span>
            Keep this page private during
            the event. Hidden Ayahs should
            never be visible to candidates.
          </span>

        </div>

      </main>

    </div>
  );
}


/* =========================================================
   GAME PAGE
========================================================= */

function GamePage({
  isLED,
}: {
  isLED: boolean;
}) {

  const [game, setGame] =
    useState<GameState>(
      initialGame
    );

  const [ledAudioUnlocked, setLedAudioUnlocked] = useState(false);
  const [ledLogoFailed, setLedLogoFailed] = useState(false);
  const [firebaseConnected, setFirebaseConnected] = useState(false);


  /* =======================================================
     AYAH DATA
  ======================================================= */

  const [ayahs, setAyahs] =
    useState<AyahData[]>(() => {
      try {
        const saved = localStorage.getItem("quriverse-ayah-data");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === TOTAL_CANDIDATES) {
            return parsed;
          }
        }
      } catch {
        // Ignore invalid local data.
      }
      return createInitialAyahs();
    });

  useEffect(() => {
    const unsubscribe = onValue(ayahsRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const value = snapshot.val();
      const next = Array.isArray(value)
        ? value
        : Object.keys(value)
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => value[key]);

      if (next.length === TOTAL_CANDIDATES) {
        setAyahs(next);
        localStorage.setItem("quriverse-ayah-data", JSON.stringify(next));
      }
    });

    return unsubscribe;
  }, []);


  /* =======================================================
     AUDIO
  ======================================================= */

  const musicRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const correctRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const wrongRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const identifiedRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const revealRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const startRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const buzzRef =
    useRef<HTMLAudioElement | null>(
      null
    );


  /*
   * Create audio elements once.
   */

  useEffect(() => {

    musicRef.current =
      new Audio(
        "/audio/background.mp3"
      );

    musicRef.current.loop =
      true;

    correctRef.current =
      new Audio(
        "/audio/correct.mp3"
      );

    wrongRef.current =
      new Audio(
        "/audio/wrong.mp3"
      );

    identifiedRef.current =
      new Audio(
        "/audio/identified.mp3"
      );

    revealRef.current =
      new Audio(
        "/audio/reveal.mp3"
      );

    startRef.current =
      new Audio(
        "/audio/start.mp3"
      );

    buzzRef.current =
      new Audio(
        "/audio/buzz.mp3"
      );

    [
      musicRef.current,
      correctRef.current,
      wrongRef.current,
      identifiedRef.current,
      revealRef.current,
      startRef.current,
      buzzRef.current,
    ].forEach((audio) => {
      if (audio) audio.preload = "auto";
    });


    return () => {

      musicRef.current?.pause();

      musicRef.current =
        null;

      correctRef.current =
        null;

      wrongRef.current =
        null;

      identifiedRef.current =
        null;

      revealRef.current =
        null;

      startRef.current =
        null;

      buzzRef.current =
        null;

    };

  }, []);


  /*
   * Audio helper.
   */

  const unlockLedAudio = () => {
    if (!isLED) return;

    setLedAudioUnlocked(true);

    // Prime the audio elements from a real user gesture so later
    // Firebase-driven sounds are allowed by the browser.
    [
      musicRef.current,
      correctRef.current,
      wrongRef.current,
      identifiedRef.current,
      revealRef.current,
      startRef.current,
      buzzRef.current,
    ].forEach((audio) => {
      if (!audio) return;
      audio.load();
    });
  };

  const playSound = (
    audio: HTMLAudioElement | null,
    force = false
  ) => {
    if (!audio) return;

    if (!force && !game.audioEnabled) return;
    if (isLED && !ledAudioUnlocked) return;

    audio.currentTime = 0;
    audio.play().catch((error) => {
      console.warn("LED audio playback was blocked:", error);
    });
  };


  useEffect(() => {
    if (!isLED || ledAudioUnlocked) return;

    const unlock = () => unlockLedAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [isLED, ledAudioUnlocked]);


  /*
   * Background music.
   */

  useEffect(() => {

    const music =
      musicRef.current;

    if (!music) return;


    music.volume =
      game.musicVolume;


    if (
      game.audioEnabled &&
      game.musicPlaying &&
      game.status !== "timeout" &&
      game.status !== "reveal" &&
      game.status !== "result"
    ) {

      music
        .play()
        .catch(() => {});

    } else {

      music.pause();
    }

  }, [
    isLED,
    game.audioEnabled,
    game.musicPlaying,
    game.musicVolume,
    ledAudioUnlocked,
  ]);


  /*
   * Play event sounds on LED.
   */

  const previousStatus =
    useRef<GameStatus>(
      game.status
    );


  useEffect(() => {

    if (!isLED) return;

    if (
      previousStatus.current ===
      game.status
    ) {
      return;
    }

    const previous =
      previousStatus.current;

    previousStatus.current =
      game.status;


    if (game.status === "yes") {
      playSound(
        correctRef.current
      );
    }


    if (game.status === "no") {
      playSound(
        wrongRef.current
      );
    }

    if (game.status === "timeout") {
      musicRef.current?.pause();
      if (musicRef.current) musicRef.current.currentTime = 0;

      // The timeout buzzer is mandatory and does not depend on the
      // moderator's optional event-audio toggle.
      playSound(buzzRef.current, true);
    }


    if (
      game.status ===
      "identified"
    ) {
      playSound(
        identifiedRef.current
      );
    }


    if (
      game.status === "reveal"
    ) {
      playSound(
        revealRef.current
      );
    }


    if (
      game.status ===
        "question" &&
      previous === "idle"
    ) {
      playSound(
        startRef.current
      );
    }

  }, [isLED, game.status]);


  /* =======================================================
     FIREBASE GAME STATE
  ======================================================= */

  useEffect(() => {
    const unsubscribe = onValue(gameRef, (snapshot) => {
      if (!snapshot.exists()) {
        if (!isLED) {
          set(gameRef, initialGame).catch((error) =>
            console.error("Failed to initialize Firebase game:", error)
          );
        }
        return;
      }

      const value = snapshot.val() as GameState;
      const normalized: GameState = {
        ...initialGame,
        ...value,
        results: (Array.isArray(value.results)
          ? value.results
          : value.results
            ? Object.values(value.results as unknown as Record<string, CandidateResult>)
            : []
        ).map((result) => ({
          ...result,
          candidateName: result.candidateName || `Candidate ${result.candidate}`,
        })),
      };

      setGame(normalized);
    });

    return unsubscribe;
  }, [isLED]);

  useEffect(() => {
    const unsubscribe = onValue(connectionRef, (snapshot) => {
      setFirebaseConnected(snapshot.val() === true);
    });

    return unsubscribe;
  }, []);

  const updateGame = (next: GameState) => {
    if (isLED) return;

    setGame(next);
    set(gameRef, next).catch((error) =>
      console.error("Failed to sync game state:", error)
    );
  };


  /* =======================================================
     TIMER
  ======================================================= */

  const gameStateRef = useRef<GameState>(game);

  useEffect(() => {
    gameStateRef.current = game;
  }, [game]);

  useEffect(() => {
    if (isLED) return;
    if (game.status !== "question" || !game.startedAt) return;

    const timer = window.setInterval(() => {
      const current = gameStateRef.current;
      if (current.status !== "question" || !current.startedAt) return;

      const elapsed = Math.min(
        MAX_TIME,
        Math.floor((Date.now() - current.startedAt) / 1000)
      );

      if (elapsed >= MAX_TIME) {
        const failedResult: CandidateResult = {
          candidate: current.candidateIndex,
          candidateName: ayahs[current.candidateIndex - 1]?.candidateName || `Candidate ${current.candidateIndex}`,
          identified: false,
          stoppingQuestion: current.attempt,
          time: MAX_TIME,
        };

        const results = [...current.results];
        const existingIndex = results.findIndex(
          (result) => result.candidate === current.candidateIndex
        );

        if (existingIndex >= 0) {
          results[existingIndex] = failedResult;
        } else {
          results.push(failedResult);
        }

        updateGame({
          ...current,
          status: "timeout",
          elapsed: MAX_TIME,
          feedback: null,
          ayahIdentified: false,
          completed: false,
          stoppingQuestion: current.attempt,
          result: failedResult,
          results,
        });
        return;
      }

      setGame((local) => ({ ...local, elapsed }));
      gameStateRef.current = { ...current, elapsed };
    }, 250);

    return () => window.clearInterval(timer);
  }, [isLED, game.status, game.startedAt]);

  /* LED calculates the visible timer locally from the moderator's start timestamp. */
  const [ledElapsed, setLedElapsed] = useState(game.elapsed);

  useEffect(() => {
    if (!isLED || game.status !== "question" || !game.startedAt) {
      setLedElapsed(game.elapsed);
      return;
    }

    const tick = () => {
      setLedElapsed(
        Math.min(
          MAX_TIME,
          Math.floor((Date.now() - game.startedAt!) / 1000)
        )
      );
    };

    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [isLED, game.status, game.startedAt, game.elapsed]);


  const getCurrentElapsed = () => {
    if (game.startedAt && game.status === "question") {
      return Math.min(
        MAX_TIME,
        Math.floor((Date.now() - game.startedAt) / 1000)
      );
    }
    return game.elapsed;
  };


  /* =======================================================
     START ROUND
  ======================================================= */

  const startRound = () => {

    updateGame({

      ...game,

      status:
        "question",

      attempt:
        1,

      elapsed:
        0,

      startedAt:
        Date.now(),

      feedback:
        null,

      ayahIdentified:
        false,

      completed:
        false,

      stoppingQuestion:
        null,

      result:
        null,
    });
  };


  /* =======================================================
     YES
  ======================================================= */

  const markYes = () => {

    if (
      game.status !==
      "question"
    ) {
      return;
    }


    updateGame({

      ...game,

      elapsed: getCurrentElapsed(),

      status:
        "yes",

      feedback:
        "yes",
    });
  };


  /* =======================================================
     NO
  ======================================================= */

  const markNo = () => {

    if (
      game.status !==
      "question"
    ) {
      return;
    }


    /*
     * Question 15 ends the questioning
     * phase.
     */

    if (
      game.attempt >=
      MAX_QUESTIONS
    ) {

      const failedResult:
        CandidateResult = {

        candidate:
          game.candidateIndex,

        candidateName:
          currentAyah?.candidateName || `Candidate ${game.candidateIndex}`,

        identified:
          false,

        stoppingQuestion:
          game.attempt,

        time:
          getCurrentElapsed(),
      };


      const results = [
        ...game.results,
      ];


      const existingIndex =
        results.findIndex(
          (result) =>
            result.candidate ===
            game.candidateIndex
        );


      if (
        existingIndex >= 0
      ) {

        results[
          existingIndex
        ] =
          failedResult;

      } else {

        results.push(
          failedResult
        );
      }


      updateGame({

        ...game,

        status:
          "timeout",

        feedback:
          "no",

        ayahIdentified:
          false,

        completed:
          false,

        stoppingQuestion:
          game.attempt,

        result:
          failedResult,

        results,
      });

      return;
    }


    updateGame({

      ...game,

      status:
        "no",

      feedback:
        "no",
    });
  };


  /* =======================================================
     NEXT QUESTION
  ======================================================= */

  const nextQuestion = () => {

    if (game.completed) {
      return;
    }


    if (
      game.status !==
        "yes" &&
      game.status !==
        "no"
    ) {
      return;
    }


    if (
      game.attempt >=
      MAX_QUESTIONS
    ) {
      return;
    }


    updateGame({

      ...game,

      status:
        "question",

      attempt:
        game.attempt + 1,

      feedback:
        null,
    });
  };


  /* =======================================================
     AYAH IDENTIFIED
  ======================================================= */

  const identifyAyah = () => {

    if (game.completed) {
      return;
    }


    if (
      game.status !==
        "question" &&
      game.status !==
        "yes" &&
      game.status !==
        "no"
    ) {
      return;
    }


    updateGame({

      ...game,

      elapsed: getCurrentElapsed(),

      status:
        "identified",

      ayahIdentified:
        true,
    });
  };


  /* =======================================================
     REVEAL ANSWER
  ======================================================= */

  const revealAnswer = () => {

    if (game.completed) {
      return;
    }


    if (
      game.status !==
        "identified" &&
      game.status !==
        "timeout"
    ) {
      return;
    }


    const stoppingQuestion =
      game.attempt;


    const finalResult:
      CandidateResult = {

      candidate:
        game.candidateIndex,

      candidateName:
        currentAyah?.candidateName || `Candidate ${game.candidateIndex}`,

      identified:
        game.ayahIdentified,

      stoppingQuestion,

      time:
        getCurrentElapsed(),
    };


    const results = [
      ...game.results,
    ];


    const existingIndex =
      results.findIndex(
        (result) =>
          result.candidate ===
          game.candidateIndex
      );


    if (
      existingIndex >= 0
    ) {

      results[
        existingIndex
      ] =
        finalResult;

    } else {

      results.push(
        finalResult
      );
    }


    updateGame({

      ...game,

      elapsed: getCurrentElapsed(),

      status:
        "reveal",

      completed:
        true,

      stoppingQuestion,

      result:
        finalResult,

      results,
    });
  };


  /* =======================================================
     SHOW RESULT
  ======================================================= */

  const showResult = () => {

    if (!game.completed) {
      return;
    }


    updateGame({

      ...game,

      status:
        "result",
    });
  };


  /* =======================================================
     NEXT CANDIDATE
  ======================================================= */

  const nextCandidate = () => {

    if (!game.completed) {
      return;
    }


    if (
      game.candidateIndex >=
      TOTAL_CANDIDATES
    ) {
      return;
    }


    updateGame({

      ...game,

      status:
        "idle",

      candidateIndex:
        game.candidateIndex + 1,

      attempt:
        1,

      elapsed:
        0,

      startedAt:
        null,

      feedback:
        null,

      ayahIdentified:
        false,

      completed:
        false,

      stoppingQuestion:
        null,

      result:
        null,
    });
  };


  /* =======================================================
     RESTART EVENT
  ======================================================= */

  const restartEvent = () => {
    const confirmed = window.confirm(
      "Restart the event from Candidate 1? All current candidate results will be cleared. Ayah setup will remain."
    );

    if (!confirmed) return;

    updateGame({
      ...initialGame,
      audioEnabled: game.audioEnabled,
      musicPlaying: game.musicPlaying,
      musicVolume: game.musicVolume,
    });
  };


  /* =======================================================
     AUDIO CONTROLS
  ======================================================= */

  const enableAudio = () => {

    /*
     * This click gives the browser
     * permission to play audio.
     */

    updateGame({

      ...game,

      audioEnabled:
        true,

      musicPlaying:
        true,
    });
  };


  const toggleMusic = () => {

    updateGame({

      ...game,

      musicPlaying:
        !game.musicPlaying,
    });
  };


  const muteAudio = () => {

    updateGame({

      ...game,

      audioEnabled:
        false,

      musicPlaying:
        false,
    });
  };


  const changeVolume = (
    volume: number
  ) => {

    updateGame({

      ...game,

      musicVolume:
        volume,
    });
  };


  /* =======================================================
     FINAL RANKING
  ======================================================= */

  const sortedResults =
    [...game.results].sort(
      (a, b) => {

        if (
          a.identified !==
          b.identified
        ) {

          return a.identified
            ? -1
            : 1;
        }


        if (
          a.stoppingQuestion !==
          b.stoppingQuestion
        ) {

          return (
            a.stoppingQuestion -
            b.stoppingQuestion
          );
        }


        return (
          a.time -
          b.time
        );
      }
    );


  const currentAyah =
    ayahs[
      game.candidateIndex - 1
    ];


  /* =======================================================
     LED SCREEN
  ======================================================= */

  if (isLED) {
    const ledParticles = Array.from({ length: 34 }, (_, i) => ({
      left: `${(i * 29) % 101}%`,
      top: `${12 + ((i * 47) % 78)}%`,
      size: `${2 + (i % 3)}px`,
      delay: `${(i % 11) * 0.65}s`,
      duration: `${5 + (i % 7)}s`,
      drift: `${-35 + ((i * 17) % 70)}px`,
    }));

    return (
      <div className="app led-screen ledfx-screen">
        <style>{`
          .ledfx-screen {
            --led-pink: #ff4f78;
            --led-hot: #ff315f;
            --led-soft: #ff91a8;
            --led-white: #fff8fa;
            --led-red: #7e1028;
            position: relative;
            width: 100vw;
            height: 100vh;
            min-height: 100vh;
            overflow: hidden;
            background:
              radial-gradient(circle at 84% 30%, rgba(139, 20, 49, .38), transparent 24%),
              radial-gradient(circle at 8% 76%, rgba(115, 14, 39, .34), transparent 25%),
              radial-gradient(circle at 50% 100%, rgba(255, 38, 87, .12), transparent 38%),
              linear-gradient(120deg, #030102 0%, #080103 48%, #130308 100%);
            color: var(--led-white);
            isolation: isolate;
          }

          .ledfx-screen::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: -6;
            background:
              linear-gradient(115deg, transparent 0 39%, rgba(255, 58, 93, .045) 47%, transparent 55%),
              radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,.38) 78%);
            animation: ledfx-breathe 7s ease-in-out infinite alternate;
          }

          .ledfx-top-wave,
          .ledfx-bottom-wave {
            position: absolute;
            z-index: -2;
            pointer-events: none;
            opacity: .78;
          }

          .ledfx-top-wave { top: -5vh; left: -2vw; width: 42vw; height: 28vh; }
          .ledfx-bottom-wave { right: -3vw; bottom: -3vh; width: 43vw; height: 34vh; transform: rotate(2deg); }

          .ledfx-wave-line {
            fill: none;
            stroke: rgba(255, 55, 91, .54);
            stroke-width: 1.2;
            vector-effect: non-scaling-stroke;
            stroke-dasharray: 8 12;
            animation: ledfx-wave-flow 5s linear infinite;
          }

          .ledfx-wave-line:nth-child(2n) { opacity: .68; animation-duration: 6.5s; }
          .ledfx-wave-line:nth-child(3n) { opacity: .42; animation-duration: 8s; }

          .ledfx-grid {
            position: absolute;
            z-index: -3;
            left: 15%;
            right: 0;
            bottom: -7%;
            height: 31%;
            opacity: .48;
            transform: perspective(520px) rotateX(57deg);
            transform-origin: center top;
            background-image:
              linear-gradient(rgba(255, 53, 91, .25) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 53, 91, .22) 1px, transparent 1px);
            background-size: 52px 28px;
            mask-image: linear-gradient(to top, black, transparent 88%);
            animation: ledfx-grid-drift 9s linear infinite;
          }

          .ledfx-floor-glow {
            position: absolute;
            z-index: -2;
            left: 0;
            right: 0;
            bottom: 18%;
            height: 2px;
            background: linear-gradient(90deg, transparent, var(--led-hot), #ffd2db, var(--led-hot), transparent);
            box-shadow: 0 0 14px var(--led-hot), 0 0 38px rgba(255, 49, 95, .65);
            animation: ledfx-floor-pulse 3.2s ease-in-out infinite;
          }

          .ledfx-floor-glow::after {
            content: "";
            position: absolute;
            left: 50%;
            top: -18px;
            width: 28vw;
            height: 40px;
            transform: translateX(-50%);
            background: radial-gradient(ellipse, rgba(255, 55, 91, .32), transparent 70%);
            filter: blur(8px);
          }

          .ledfx-sweep {
            position: absolute;
            z-index: -1;
            width: 75vw;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255, 105, 130, .8), transparent);
            box-shadow: 0 0 18px rgba(255, 49, 95, .55);
            opacity: .5;
            transform: rotate(-19deg);
            animation: ledfx-sweep 7s ease-in-out infinite;
          }

          .ledfx-sweep.one { top: 24%; left: -65%; }
          .ledfx-sweep.two { top: 67%; left: 22%; animation-delay: 2.8s; transform: rotate(14deg); opacity: .3; }

          .ledfx-particle {
            position: absolute;
            z-index: -1;
            border-radius: 50%;
            background: #ff6f8d;
            box-shadow: 0 0 7px #ff4f78, 0 0 16px rgba(255, 49, 95, .7);
            animation: ledfx-particle-float var(--duration) ease-in-out var(--delay) infinite;
          }

          .ledfx-corner-stripes {
            position: absolute;
            z-index: -1;
            width: 180px;
            height: 72px;
            opacity: .85;
            overflow: hidden;
          }

          .ledfx-corner-stripes span {
            display: block;
            width: 38px;
            height: 110px;
            margin-left: 18px;
            margin-top: -18px;
            background: linear-gradient(180deg, #ff718d, #c51c47);
            transform: skewX(31deg);
            box-shadow: 0 0 18px rgba(255, 49, 95, .22);
          }

          .ledfx-corner-stripes span + span { margin-left: 66px; margin-top: -110px; }
          .ledfx-corner-stripes span + span + span { margin-left: 114px; margin-top: -110px; }
          .ledfx-corner-stripes.top { top: 0; right: 8%; }
          .ledfx-corner-stripes.bottom { bottom: 0; left: 0; transform: rotate(180deg); }

          .ledfx-brand {
            position: absolute;
            top: 3.4vh;
            left: 3.4vw;
            display: flex;
            align-items: center;
            gap: 13px;
            z-index: 4;
          }

          .ledfx-brand-logo {
            width: clamp(190px, 18vw, 340px);
            height: auto;
            display: block;
            filter: drop-shadow(0 0 12px rgba(255, 49, 95, .34));
          }

          .ledfx-logo-fallback {
            display: grid;
            grid-template-columns: auto auto;
            align-items: center;
            column-gap: 10px;
            position: relative;
          }

          .ledfx-logo-mark {
            width: 34px;
            height: 34px;
            border: 3px solid #ff587a;
            border-radius: 50%;
            color: transparent;
            box-shadow: 0 0 18px rgba(255, 88, 122, .35);
            position: relative;
          }

          .ledfx-logo-mark::after {
            content: "";
            position: absolute;
            width: 16px;
            height: 3px;
            background: #ff587a;
            right: -12px;
            bottom: 0;
            transform: rotate(45deg);
            transform-origin: left center;
          }

          .ledfx-logo-word {
            font-size: clamp(22px, 1.7vw, 38px);
            font-weight: 800;
            letter-spacing: .18em;
            color: #fff;
            text-shadow: 0 0 16px rgba(255, 88, 122, .22);
          }

          .ledfx-logo-tag {
            grid-column: 2;
            margin-top: -7px;
            font-size: 7px;
            letter-spacing: .36em;
            opacity: .72;
          }

          .ledfx-brand-name {
            font-size: clamp(16px, 1.55vw, 28px);
            letter-spacing: .38em;
            font-weight: 600;
          }

          .ledfx-brand-tag {
            position: absolute;
            left: 47px;
            top: 29px;
            white-space: nowrap;
            font-size: clamp(6px, .48vw, 10px);
            letter-spacing: .42em;
            opacity: .7;
          }

          .ledfx-top-right {
            position: absolute;
            top: 3.5vh;
            right: 4vw;
            text-align: right;
            font-size: clamp(7px, .55vw, 11px);
            line-height: 1.75;
            letter-spacing: .38em;
            opacity: .76;
            z-index: 4;
          }

          .ledfx-top-right::after,
          .ledfx-footer::after {
            content: "";
            display: block;
            width: 42px;
            height: 1px;
            margin-top: 9px;
            margin-left: auto;
            background: var(--led-pink);
            box-shadow: 0 0 8px var(--led-pink);
          }

          .ledfx-side-dots {
            position: absolute;
            top: 42%;
            left: 2.7vw;
            display: flex;
            flex-direction: column;
            gap: 13px;
            z-index: 3;
          }

          .ledfx-side-dots::before,
          .ledfx-side-dots::after {
            content: "";
            width: 1px;
            height: 66px;
            margin-left: 4px;
            background: linear-gradient(transparent, rgba(255, 79, 120, .75), transparent);
          }

          .ledfx-side-dots::after { order: 5; height: 22px; }
          .ledfx-side-dots i {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #63313d;
          }
          .ledfx-side-dots i.active {
            background: var(--led-pink);
            box-shadow: 0 0 10px var(--led-pink);
          }

          .ledfx-footer {
            position: absolute;
            bottom: 6vh;
            left: 12vw;
            font-size: clamp(7px, .52vw, 11px);
            line-height: 1.7;
            letter-spacing: .42em;
            opacity: .76;
            z-index: 4;
          }

          .ledfx-footer::after { margin-left: 0; }

          .ledfx-center {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 8vh 7vw 11vh;
            z-index: 2;
          }

          .ledfx-center::before {
            content: "";
            position: absolute;
            width: min(56vw, 920px);
            height: min(42vh, 390px);
            border-radius: 50%;
            background: radial-gradient(ellipse, rgba(116, 9, 37, .18), transparent 68%);
            filter: blur(16px);
            z-index: -1;
            animation: ledfx-center-breathe 4.8s ease-in-out infinite;
          }

          .ledfx-kicker {
            font-size: clamp(8px, .65vw, 13px);
            letter-spacing: .55em;
            text-transform: uppercase;
            opacity: .72;
            margin-bottom: 18px;
          }

          .ledfx-main-title {
            display: none;
          }

          .ledfx-question-label {
            margin-top: 34px;
            font-size: clamp(24px, 2.2vw, 44px);
            letter-spacing: .34em;
            font-weight: 650;
            color: var(--led-white);
            text-shadow: 0 0 14px rgba(255, 88, 122, .25);
            transition: color .25s ease, text-shadow .25s ease, filter .25s ease;
          }

          .ledfx-question-label.warning {
            color: #ff5475;
            text-shadow: 0 0 10px rgba(255, 49, 95, .9), 0 0 35px rgba(255, 49, 95, .55);
            animation: ledfx-warning-blink .72s steps(2, start) infinite;
          }

          .ledfx-timer {
            margin-top: 22px;
            font-size: clamp(58px, 7vw, 132px);
            line-height: 1;
            font-weight: 300;
            letter-spacing: .035em;
            color: var(--led-white);
            text-shadow: 0 0 22px rgba(255, 255, 255, .22), 0 0 34px rgba(255, 67, 100, .2);
            transition: color .25s ease, text-shadow .25s ease;
          }

          .ledfx-timer.warning {
            color: #ff5b78;
            text-shadow: 0 0 14px rgba(255, 49, 95, .95), 0 0 45px rgba(255, 49, 95, .65);
            animation: ledfx-warning-blink .8s steps(2, start) infinite;
          }

          .ledfx-instruction {
            margin-top: 25px;
            font-size: clamp(8px, .65vw, 13px);
            letter-spacing: .42em;
            opacity: .58;
          }

          .ledfx-candidate {
            position: absolute;
            top: 14vh;
            left: 50%;
            transform: translateX(-50%);
            font-size: clamp(8px, .62vw, 12px);
            letter-spacing: .45em;
            opacity: .55;
          }

          .ledfx-idle-title {
            font-size: clamp(48px, 7vw, 130px);
            font-weight: 800;
            letter-spacing: -.03em;
            color: #ff587a;
            text-shadow: 0 0 30px rgba(255, 49, 95, .5);
          }

          .ledfx-idle-sub {
            margin-top: 18px;
            letter-spacing: .5em;
            font-size: clamp(9px, .75vw, 15px);
            opacity: .68;
          }

          .ledfx-feedback {
            isolation: isolate;
          }

          .ledfx-feedback::before,
          .ledfx-feedback::after {
            content: "";
            position: absolute;
            left: 50%;
            top: 50%;
            width: min(55vw, 820px);
            height: min(55vw, 820px);
            transform: translate(-50%, -50%) scale(.55);
            border: 1px solid rgba(255, 79, 120, .16);
            border-radius: 50%;
            filter: blur(1px);
            z-index: -2;
            animation: ledfx-suspense-ring 2.8s ease-out infinite;
          }

          .ledfx-feedback::after {
            width: min(34vw, 500px);
            height: min(34vw, 500px);
            border-style: dashed;
            animation-delay: .65s;
            animation-duration: 2.2s;
          }

          .ledfx-feedback-word {
            position: relative;
            font-size: clamp(82px, 13vw, 250px);
            line-height: .85;
            font-weight: 900;
            letter-spacing: -.06em;
            color: var(--led-pink);
            text-shadow: 0 0 18px rgba(255, 79, 120, .8), 0 0 60px rgba(255, 49, 95, .55);
            animation: ledfx-feedback-in .7s cubic-bezier(.18,.85,.25,1) both, ledfx-feedback-breathe 1.8s ease-in-out .2s infinite;
          }

          .ledfx-feedback-word::before,
          .ledfx-feedback-word::after {
            content: "";
            position: absolute;
            inset: -24px -38px;
            border-radius: 999px;
            background: radial-gradient(ellipse, rgba(255, 79, 120, .18), transparent 67%);
            filter: blur(20px);
            z-index: -1;
            animation: ledfx-blur-pulse 1.6s ease-in-out infinite;
          }

          .ledfx-feedback-word::after {
            inset: -70px -120px;
            opacity: .45;
            animation-delay: .4s;
            animation-duration: 2.4s;
          }

          /* YES = GREEN */
          .ledfx-yes .ledfx-feedback-word {
            color: #35e58a;
            text-shadow: 0 0 18px rgba(53, 229, 138, .95), 0 0 60px rgba(28, 190, 105, .62);
          }

          .ledfx-yes::before {
            border-color: rgba(53, 229, 138, .24);
          }

          .ledfx-yes .ledfx-feedback-word::before,
          .ledfx-yes .ledfx-feedback-word::after {
            background: radial-gradient(ellipse, rgba(53, 229, 138, .2), transparent 67%);
          }

          .ledfx-no .ledfx-feedback-word {
            color: #ff335f;
          }

          .ledfx-identified .ledfx-status-title { font-size: clamp(48px, 7vw, 132px); }
          .ledfx-status-meta {
            margin-top: 28px;
            font-size: clamp(10px, .9vw, 18px);
            letter-spacing: .4em;
          }
          .ledfx-status-time {
            margin-top: 13px;
            font-size: clamp(42px, 5vw, 92px);
            font-weight: 300;
          }

          .ledfx-reveal-title {
            font-size: clamp(42px, 5.8vw, 112px);
            color: #ff587a;
            font-weight: 800;
            letter-spacing: -.03em;
            text-shadow: 0 0 30px rgba(255, 49, 95, .5);
          }
          .ledfx-reveal-small {
            font-size: clamp(9px, .7vw, 14px);
            letter-spacing: .5em;
            opacity: .58;
            margin-bottom: 15px;
          }
          .ledfx-reveal-stop {
            margin-top: 17px;
            font-size: clamp(8px, .65vw, 13px);
            letter-spacing: .35em;
            opacity: .68;
          }
          .ledfx-ayah {
            width: min(78vw, 1180px);
            margin-top: 35px;
            padding: 30px 38px;
            border-top: 1px solid rgba(255, 79, 120, .35);
            border-bottom: 1px solid rgba(255, 79, 120, .35);
            background: linear-gradient(90deg, transparent, rgba(86, 7, 26, .2), transparent);
            animation: ledfx-reveal-in .9s ease both;
          }
          .ledfx-surah { font-size: clamp(10px, .75vw, 15px); letter-spacing: .35em; opacity: .72; }
          .ledfx-arabic { margin-top: 20px; font-size: clamp(24px, 2.6vw, 52px); line-height: 1.9; color: #fff2f5; text-shadow: 0 0 18px rgba(255, 79, 120, .18); }
          .ledfx-translation { margin-top: 15px; font-size: clamp(10px, .9vw, 17px); line-height: 1.7; opacity: .72; max-width: 900px; margin-left: auto; margin-right: auto; }

          .ledfx-result-title { font-size: clamp(45px, 6.5vw, 125px); font-weight: 800; color: #ff587a; text-shadow: 0 0 30px rgba(255, 49, 95, .55); }
          .ledfx-result-candidate { font-size: clamp(9px, .7vw, 14px); letter-spacing: .5em; opacity: .65; margin-bottom: 17px; }
          .ledfx-result-details { margin-top: 28px; font-size: clamp(10px, 1vw, 20px); line-height: 2.2; letter-spacing: .35em; }

          .ledfx-final-board {
            width: min(92vw, 1180px);
            max-height: 88vh;
            justify-content: flex-start;
            padding: clamp(20px, 3vh, 44px) 0;
            overflow: hidden;
          }

          .ledfx-final-kicker {
            font-size: clamp(9px, .7vw, 14px);
            letter-spacing: .5em;
            opacity: .68;
            margin-bottom: 10px;
          }

          .ledfx-final-title {
            font-size: clamp(42px, 6vw, 104px);
            line-height: .95;
            font-weight: 800;
            letter-spacing: .03em;
            color: #ff587a;
            text-shadow: 0 0 30px rgba(255, 49, 95, .55);
            margin-bottom: 8px;
          }

          .ledfx-final-subtitle {
            font-size: clamp(9px, .8vw, 16px);
            letter-spacing: .48em;
            opacity: .62;
            margin-bottom: clamp(18px, 3vh, 34px);
          }

          .ledfx-ranking-board {
            width: min(100%, 1120px);
            display: grid;
            gap: clamp(9px, 1vh, 14px);
          }

          .ledfx-ranking-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .ledfx-ranking-row {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: clamp(128px, 15vh, 170px);
            padding: clamp(14px, 1.5vw, 22px);
            border: 1px solid rgba(255, 88, 122, .2);
            border-radius: 20px;
            background: linear-gradient(145deg, rgba(255, 35, 77, .085), rgba(255, 35, 77, .018));
            box-shadow: inset 0 0 28px rgba(255, 35, 77, .025);
            backdrop-filter: blur(8px);
          }

          .ledfx-ranking-row.winner {
            border-color: rgba(255, 88, 122, .62);
            background: linear-gradient(90deg, rgba(255, 35, 77, .18), rgba(255, 35, 77, .045));
            box-shadow: 0 0 28px rgba(255, 35, 77, .16), inset 0 0 35px rgba(255, 35, 77, .06);
            animation: ledfxWinnerPulse 2.4s ease-in-out infinite;
          }

          .ledfx-rank {
            font-size: clamp(20px, 2vw, 34px);
            font-weight: 800;
            color: #ff587a;
            letter-spacing: .08em;
          }

          .ledfx-rank-candidate {
            font-size: clamp(12px, 1.05vw, 20px);
            line-height: 1.25;
            letter-spacing: .16em;
            text-align: left;
            min-height: 2.5em;
            display: flex;
            align-items: center;
          }

          .ledfx-rank-status,
          .ledfx-rank-time {
            font-size: clamp(9px, .72vw, 15px);
            letter-spacing: .18em;
            text-align: right;
          }

          .ledfx-rank-status.solved {
            color: #ffdbe3;
          }

          .ledfx-rank-status.failed {
            color: #ff6d84;
            opacity: .72;
          }

          .ledfx-rank-time {
            opacity: .78;
          }

          .ledfx-winner-line {
            margin-top: clamp(14px, 2vh, 24px);
            font-size: clamp(10px, .85vw, 17px);
            letter-spacing: .42em;
            color: #ff587a;
            text-shadow: 0 0 18px rgba(255, 49, 95, .45);
          }

          @keyframes ledfxWinnerPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 24px rgba(255, 35, 77, .12), inset 0 0 30px rgba(255, 35, 77, .04); }
            50% { transform: scale(1.008); box-shadow: 0 0 38px rgba(255, 35, 77, .24), inset 0 0 38px rgba(255, 35, 77, .08); }
          }

          @media (max-width: 1050px) {
            .ledfx-ranking-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .ledfx-ranking-grid {
              grid-template-columns: 1fr;
            }
          }

          .ledfx-audio-unlock {
            position: absolute;
            right: 24px;
            bottom: 22px;
            z-index: 20;
            border: 1px solid rgba(255, 79, 120, .55);
            background: rgba(10, 2, 5, .84);
            color: #fff;
            padding: 10px 15px;
            font-size: 10px;
            letter-spacing: .25em;
            cursor: pointer;
            backdrop-filter: blur(10px);
          }

          @keyframes ledfx-wave-flow { to { stroke-dashoffset: -120; } }
          @keyframes ledfx-grid-drift { to { background-position: 0 28px, 52px 0; } }
          @keyframes ledfx-breathe { from { opacity: .72; } to { opacity: 1; } }
          @keyframes ledfx-center-breathe { 0%,100% { transform: scale(.96); opacity: .7; } 50% { transform: scale(1.05); opacity: 1; } }
          @keyframes ledfx-title-breathe { 0%,100% { filter: brightness(.94); } 50% { filter: brightness(1.12); } }
          @keyframes ledfx-floor-pulse { 0%,100% { opacity: .5; transform: scaleX(.72); } 50% { opacity: 1; transform: scaleX(1); } }
          @keyframes ledfx-sweep { 0% { transform: translateX(-15vw) rotate(-19deg); opacity: 0; } 15% { opacity: .6; } 70% { opacity: .2; } 100% { transform: translateX(120vw) rotate(-19deg); opacity: 0; } }
          @keyframes ledfx-particle-float { 0% { transform: translate3d(0, 24px, 0) scale(.7); opacity: 0; } 18% { opacity: .9; } 55% { transform: translate3d(var(--drift), -22px, 0) scale(1); opacity: .65; } 100% { transform: translate3d(calc(var(--drift) * -1), -90px, 0) scale(.35); opacity: 0; } }
          @keyframes ledfx-feedback-in { from { transform: scale(.72); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes ledfx-reveal-in { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes ledfx-warning-blink { 0%, 45% { opacity: 1; } 46%, 100% { opacity: .22; } }
          @keyframes ledfx-suspense-ring { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.42); } 18% { opacity: .75; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.12); } }
          @keyframes ledfx-feedback-breathe { 0%, 100% { transform: scale(.98); filter: blur(0); } 50% { transform: scale(1.035); filter: blur(.2px); } }
          @keyframes ledfx-blur-pulse { 0%, 100% { transform: scale(.85); opacity: .22; } 50% { transform: scale(1.18); opacity: .7; } }

          @media (max-aspect-ratio: 4/3) {
            .ledfx-top-wave { width: 55vw; }
            .ledfx-bottom-wave { width: 55vw; }
            .ledfx-main-title { font-size: clamp(42px, 8vw, 90px); }
          }

          @media (prefers-reduced-motion: reduce) {
            .ledfx-screen *, .ledfx-screen::before { animation: none !important; }
          }
        `}</style>

        {/* Animated cinematic background */}
        <svg className="ledfx-top-wave" viewBox="0 0 700 360" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <path
              key={i}
              className="ledfx-wave-line"
              d={`M-40 ${45 + i * 25} C 90 ${-30 + i * 18}, 210 ${180 + i * 4}, 330 ${85 + i * 9} S 540 ${-30 + i * 25}, 760 ${80 + i * 18}`}
            />
          ))}
        </svg>

        <svg className="ledfx-bottom-wave" viewBox="0 0 720 400" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              className="ledfx-wave-line"
              d={`M-30 ${310 - i * 20} C 120 ${390 - i * 12}, 235 ${160 - i * 4}, 390 ${265 - i * 13} S 600 ${120 - i * 10}, 760 ${195 - i * 17}`}
            />
          ))}
        </svg>

        <div className="ledfx-grid" />
        <div className="ledfx-floor-glow" />
        <div className="ledfx-sweep one" />
        <div className="ledfx-sweep two" />

        {ledParticles.map((particle, i) => (
          <span
            key={i}
            className="ledfx-particle"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              ["--duration" as string]: particle.duration,
              ["--delay" as string]: particle.delay,
              ["--drift" as string]: particle.drift,
            } as CSSProperties}
          />
        ))}

        <div className="ledfx-corner-stripes top" aria-hidden="true">
          <span /><span /><span />
        </div>
        <div className="ledfx-corner-stripes bottom" aria-hidden="true">
          <span /><span /><span />
        </div>

        <div className="ledfx-brand">
          {!ledLogoFailed ? (
            <img
              className="ledfx-brand-logo"
              src="/logo.svg"
              alt="Quriverse"
              onError={() => setLedLogoFailed(true)}
            />
          ) : (
            <div className="ledfx-logo-fallback" aria-label="Quriverse">
              <span className="ledfx-logo-mark">Q</span>
              <span className="ledfx-logo-word">QURIVERSE</span>
              <span className="ledfx-logo-tag">EXPLORE · LEARN · BELONG</span>
            </div>
          )}
        </div>

        <div className="ledfx-top-right">
          MORE THAN KNOWLEDGE<br />
          A HIGHER CONNECTION
        </div>

        <div className="ledfx-side-dots" aria-hidden="true">
          <i className="active" /><i /><i />
        </div>

        <div className="ledfx-footer">
          FAITH<br />KNOWLEDGE<br />PEOPLE
        </div>

        {!ledAudioUnlocked && (
          <button
            className="led-audio-unlock ledfx-audio-unlock"
            onClick={unlockLedAudio}
          >
            ENABLE AUDIO
          </button>
        )}

        {/* IDLE */}
        {game.status === "idle" && (
          <div className="led-center ledfx-center">
            <div className="ledfx-kicker">QURIVERSE • REVERSE QUIZ</div>
            <div className="ledfx-idle-title">GET READY</div>
            <div className="ledfx-idle-sub">THE NEXT AYAH AWAITS</div>
          </div>
        )}

        {/* QUESTION */}
        {game.status === "question" && (
          <div className="led-center ledfx-center">
            <div className="ledfx-candidate">
              {currentAyah?.candidateName || `CANDIDATE ${String(game.candidateIndex).padStart(2, "0")}`}
            </div>
            <div
              className={`ledfx-question-label ${game.attempt >= 13 ? "warning" : ""}`}
            >
              QUESTION {String(game.attempt).padStart(2, "0")} / {MAX_QUESTIONS}
            </div>
            <div
              className={`ledfx-timer ${ledElapsed >= 210 ? "warning" : ""}`}
            >
              {formatTime(ledElapsed)}
            </div>
            <div className="ledfx-instruction">ASK YOUR QUESTION</div>
          </div>
        )}

        {/* YES */}
        {game.status === "yes" && (
          <div className="led-center ledfx-center ledfx-feedback yes ledfx-yes">
            <div className="ledfx-feedback-word">YES</div>
          </div>
        )}

        {/* NO */}
        {game.status === "no" && (
          <div className="led-center ledfx-center ledfx-feedback no ledfx-no">
            <div className="ledfx-feedback-word">NO</div>
          </div>
        )}

        {/* IDENTIFIED */}
        {game.status === "identified" && (
          <div className="led-center ledfx-center ledfx-identified">
            <div className="ledfx-status-title">AYAH IDENTIFIED</div>
            <div className="ledfx-status-meta">
              QUESTION {String(game.attempt).padStart(2, "0")} / {MAX_QUESTIONS}
            </div>
            <div className="ledfx-status-time">{formatTime(game.elapsed)}</div>
          </div>
        )}

        {/* TIMEOUT */}
        {game.status === "timeout" && (
          <div className="led-center ledfx-center">
            <div className="ledfx-status-title">TIME / LIMIT</div>
            <div className="ledfx-status-meta">
              QUESTION {String(game.attempt).padStart(2, "0")} / {MAX_QUESTIONS}
            </div>
            <div className="ledfx-status-time">{formatTime(game.elapsed)}</div>
          </div>
        )}

        {/* REVEAL */}
        {game.status === "reveal" && (
          <div className="led-center ledfx-center ledfx-reveal">
            <div className="ledfx-reveal-small">QURIVERSE • REVERSE QUIZ</div>
            <div className="ledfx-reveal-title">REVEAL ANSWER</div>
            <div className="ledfx-reveal-stop">STOPPED AT QUESTION {game.stoppingQuestion}</div>

            <div className="revealed-ayah ledfx-ayah">
              {currentAyah?.surah && (
                <div className="revealed-surah ledfx-surah">
                  {currentAyah.surah}{currentAyah.ayahNumber && ` • ${currentAyah.ayahNumber}`}
                </div>
              )}

              <div className="revealed-arabic ledfx-arabic" dir="rtl">
                {currentAyah?.arabic || "AYAH NOT ENTERED"}
              </div>

              {currentAyah?.translation && (
                <div className="revealed-translation ledfx-translation">
                  {currentAyah.translation}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RESULT / FINAL LEADERBOARD */}
        {game.status === "result" && game.result && game.candidateIndex < TOTAL_CANDIDATES && (
          <div className="led-center ledfx-center led-result">
            <div className="ledfx-result-candidate">
              {game.result.candidateName || `CANDIDATE ${String(game.result.candidate).padStart(2, "0")}`}
            </div>
            <div className="ledfx-result-title">
              {game.result.identified ? "IDENTIFIED" : "NOT IDENTIFIED"}
            </div>
            <div className="ledfx-result-details">
              QUESTION {String(game.result.stoppingQuestion).padStart(2, "0")} / {MAX_QUESTIONS}
              <br />
              TIME {formatTime(game.result.time)}
            </div>
          </div>
        )}

        {game.status === "result" && game.result && game.candidateIndex === TOTAL_CANDIDATES && (
          <div className="led-center ledfx-center ledfx-final-board">
            <div className="ledfx-final-kicker">QURIVERSE • REVERSE QUIZ</div>
            <div className="ledfx-final-title">FINAL LEADERBOARD</div>
            <div className="ledfx-final-subtitle">THE RESULT IS IN</div>

            <div className="ledfx-ranking-board ledfx-ranking-grid">
              {sortedResults.map((result, index) => (
                <div
                  className={`ledfx-ranking-row ${index === 0 ? "winner" : ""}`}
                  key={result.candidate}
                >
                  <div className="ledfx-rank">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="ledfx-rank-candidate">
                    {result.candidateName || `CANDIDATE ${String(result.candidate).padStart(2, "0")}`}
                  </div>

                  <div className={`ledfx-rank-status ${result.identified ? "solved" : "failed"}`}>
                    {result.identified ? `Q${String(result.stoppingQuestion).padStart(2, "0")}` : "FAILED"}
                  </div>

                  <div className="ledfx-rank-time">
                    {formatTime(result.time)}
                  </div>
                </div>
              ))}
            </div>

            {sortedResults.length > 0 && (
              <div className="ledfx-winner-line">
                WINNER • {sortedResults[0].candidateName || `CANDIDATE ${String(sortedResults[0].candidate).padStart(2, "0")}`}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* =======================================================
     MODERATOR
  ======================================================= */

  return (
    <div className="app moderator-screen">

      <style>{`
        .restart-event-button {
          margin-top: 18px;
          width: 100%;
          border-color: rgba(255, 88, 122, .55);
          background: rgba(255, 35, 77, .06);
        }

        .restart-event-button:hover {
          border-color: rgba(255, 88, 122, .9);
          box-shadow: 0 0 24px rgba(255, 35, 77, .16);
        }

        .moderator-header-actions, .setup-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .event-restart-top-button {
          border: 1px solid rgba(255, 88, 122, .38);
          background: rgba(255, 35, 77, .045);
          color: #ff91a8;
          padding: 9px 14px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .16em;
          cursor: pointer;
          transition: .2s ease;
        }

        .event-restart-top-button:hover {
          color: #fff;
          border-color: #ff587a;
          box-shadow: 0 0 20px rgba(255, 49, 95, .2);
        }

        .final-results-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .ranking-card {
          min-height: 118px;
          padding: 15px;
          border: 1px solid rgba(255, 88, 122, .22);
          border-radius: 18px;
          background: linear-gradient(145deg, rgba(255, 35, 77, .075), rgba(255, 35, 77, .018));
          box-shadow: inset 0 0 25px rgba(255, 35, 77, .025);
        }

        .ranking-card.winner {
          border-color: rgba(255, 88, 122, .7);
          box-shadow: 0 0 24px rgba(255, 35, 77, .15), inset 0 0 25px rgba(255, 35, 77, .06);
        }

        .ranking-card-top, .ranking-card-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .ranking-card-top strong { color: #ff587a; font-size: 20px; }
        .ranking-card-top span { font-size: 8px; letter-spacing: .18em; opacity: .62; }
        .ranking-card-name { margin: 17px 0; font-size: 13px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ranking-card-stats { font-size: 10px; letter-spacing: .14em; opacity: .75; }

        @media (max-width: 900px) {
          .final-results-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 560px) {
          .final-results-grid { grid-template-columns: 1fr; }
          .moderator-header-actions, .setup-header-actions { flex-wrap: wrap; justify-content: flex-end; }
        }
      `}</style>

      <header className="moderator-header">

        <div className="brand">
          QURIVERSE
        </div>

        <div className={firebaseConnected ? "audio-status on" : "audio-status"}>
          <span />
          {firebaseConnected ? "LIVE SYNC" : "OFFLINE"}
        </div>


        <div className="moderator-header-actions">
          <button
            type="button"
            className="event-restart-top-button"
            onClick={restartEvent}
          >
            ↻ RESTART EVENT
          </button>

          <a
            href="/setup"
            className="setup-link"
          >
            AYAH SETUP
          </a>
        </div>

      </header>


      <main className="moderator-main">

        {/* CANDIDATE */}

        <div className="candidate-number">

          CANDIDATE{" "}

          <strong>
            {currentAyah?.candidateName || `CANDIDATE ${String(game.candidateIndex).padStart(2, "0")}`}
          </strong>

          <span>
            {" "}
            / {TOTAL_CANDIDATES}
          </span>

        </div>


        {/* QUESTION */}

        <div className="moderator-question">

          <div className="question-label">
            QUESTION
          </div>

          <div className="question-value">

            {String(
              game.attempt
            ).padStart(
              2,
              "0"
            )}

            <span>
              / {MAX_QUESTIONS}
            </span>

          </div>

        </div>


        {/* TIMER */}

        <div className="moderator-timer">
          {formatTime(
            game.elapsed
          )}
        </div>


        {/* START */}

        {game.status ===
          "idle" && (
          <button
            className="main-button start-button"
            onClick={
              startRound
            }
          >
            START CANDIDATE
          </button>
        )}


        {/* QUESTION */}

        {game.status ===
          "question" && (
          <div className="live-controls">

            <div className="top-controls">

              <button
                className="main-button yes-button"
                onClick={
                  markYes
                }
              >

                <span>
                  ✓
                </span>

                YES

                <small>
                  CORRECT ANSWER
                </small>

              </button>


              <button
                className="main-button no-button"
                onClick={
                  markNo
                }
              >

                <span>
                  ×
                </span>

                NO

                <small>
                  WRONG ANSWER
                </small>

              </button>

            </div>


            <button
              className="main-button identify-button"
              onClick={
                identifyAyah
              }
            >

              <span>
                ◎
              </span>

              AYAH IDENTIFIED

            </button>

          </div>
        )}


        {/* AFTER YES / NO */}

        {(game.status ===
          "yes" ||
          game.status ===
            "no") && (
          <div className="live-controls">

            <div className="feedback-status">

              {game.status ===
              "yes"
                ? "YES — CORRECT ANSWER"
                : "NO — WRONG ANSWER"}

            </div>


            <button
              className="main-button next-button"
              onClick={
                nextQuestion
              }
            >

              NEXT QUESTION

              <span>
                →
              </span>

            </button>


            <button
              className="main-button identify-button"
              onClick={
                identifyAyah
              }
            >

              <span>
                ◎
              </span>

              AYAH IDENTIFIED

            </button>

          </div>
        )}


        {/* IDENTIFIED */}

        {game.status ===
          "identified" && (
          <div className="end-controls">

            <div className="identified-status">
              AYAH IDENTIFIED
            </div>


            <button
              className="main-button reveal-button"
              onClick={
                revealAnswer
              }
            >
              REVEAL ANSWER
            </button>

          </div>
        )}


        {/* TIMEOUT */}

        {game.status ===
          "timeout" && (
          <div className="end-controls">

            <div className="timeout-status">
              TIME / QUESTION LIMIT
            </div>


            <button
              className="main-button reveal-button"
              onClick={
                revealAnswer
              }
            >
              REVEAL ANSWER
            </button>

          </div>
        )}


        {/* REVEAL */}

        {game.status ===
          "reveal" && (
          <div className="end-controls">

            <div className="revealed-status">

              CANDIDATE ENDED

              <br />

              <strong>
                QUESTION{" "}
                {
                  game.stoppingQuestion
                }
              </strong>

            </div>


            <button
              className="main-button result-button"
              onClick={
                showResult
              }
            >
              SHOW RESULT
            </button>

          </div>
        )}


        {/* RESULT */}

        {game.status ===
          "result" && (
          <div className="end-controls">

            <div className="candidate-result">

              <div>
                {game.result?.candidateName || `CANDIDATE ${String(game.result?.candidate ?? game.candidateIndex).padStart(2, "0")}`}
              </div>


              <strong>
                {game.result
                  ?.identified
                  ? "IDENTIFIED"
                  : "NOT IDENTIFIED"}
              </strong>


              <span>
                QUESTION {game.result?.stoppingQuestion} / {MAX_QUESTIONS}
                {" • "}
                TIME {game.result && formatTime(game.result.time)}
              </span>

            </div>


            {game.candidateIndex <
              TOTAL_CANDIDATES && (

              <button
                className="main-button next-candidate-button"
                onClick={
                  nextCandidate
                }
              >

                NEXT CANDIDATE

                <span>
                  →
                </span>

              </button>

            )}


            {game.candidateIndex ===
              TOTAL_CANDIDATES && (

              <div className="final-results">

                <h2>
                  FINAL RESULTS
                </h2>


                <div className="final-results-grid">
                  {sortedResults.map((result, index) => (
                    <div
                      className={`ranking-card ${index === 0 ? "winner" : ""}`}
                      key={result.candidate}
                    >
                      <div className="ranking-card-top">
                        <strong>#{index + 1}</strong>
                        <span>{result.identified ? "SOLVED" : "FAILED"}</span>
                      </div>
                      <div className="ranking-card-name">
                        {result.candidateName || `CANDIDATE ${String(result.candidate).padStart(2, "0")}`}
                      </div>
                      <div className="ranking-card-stats">
                        <span>Q {String(result.stoppingQuestion).padStart(2, "0")}</span>
                        <span>{formatTime(result.time)}</span>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}

          </div>
        )}


        {/* =================================================
            AUDIO — SEPARATE FROM MAIN CONTROLS
        ================================================= */}

        <section className="audio-panel">

          <div className="audio-panel-header">

            <div>

              <div className="audio-kicker">
                EVENT AUDIO
              </div>

              <div className="audio-title">
                SOUND CONTROL
              </div>

            </div>


            <div
              className={
                game.audioEnabled
                  ? "audio-status on"
                  : "audio-status"
              }
            >
              <span />
              {game.audioEnabled
                ? "AUDIO ON"
                : "AUDIO OFF"}
            </div>

          </div>


          <div className="audio-controls">

            <button
              className="audio-control-button"
              onClick={
                game.audioEnabled
                  ? toggleMusic
                  : enableAudio
              }
            >

              <span>
                {game.musicPlaying
                  ? "Ⅱ"
                  : "▶"}
              </span>

              {game.audioEnabled
                ? game.musicPlaying
                  ? "PAUSE MUSIC"
                  : "PLAY MUSIC"
                : "ENABLE AUDIO"}

            </button>


            <button
              className="audio-control-button mute"
              onClick={
                muteAudio
              }
            >

              MUTE

            </button>


            <div className="volume-control">

              <label>
                MUSIC
              </label>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={
                  game.musicVolume
                }
                onChange={(event) =>
                  changeVolume(
                    Number(
                      event.target.value
                    )
                  )
                }
              />

              <span>
                {Math.round(
                  game.musicVolume *
                    100
                )}
                %
              </span>

            </div>

          </div>


          <div className="audio-note">
            YES, NO, IDENTIFIED and
            REVEAL sounds play automatically.
          </div>

        </section>

      </main>

    </div>
  );
}


/* =========================================================
   TIME FORMAT
========================================================= */

function formatTime(
  seconds: number
) {

  const minutes =
    Math.floor(
      seconds / 60
    );

  const secs =
    seconds % 60;

  return `${String(
    minutes
  ).padStart(
    2,
    "0"
  )}:${String(
    secs
  ).padStart(
    2,
    "0"
  )}`;
}


export default App;