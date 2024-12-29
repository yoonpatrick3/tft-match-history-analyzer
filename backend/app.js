const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require('fs');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

require('dotenv').config();

const RIOT_API_KEY = process.env.RIOT_API_KEY;

if (!RIOT_API_KEY) {
    throw new Error("Missing Riot API Key! Make sure it's set in the .env file.");
}

app.get("/api/match-history/:username", async (req, res) => {
    try {
        const { username } = req.params;
        const [playerName, tagline] = username.split("#");

        const summonerResponse = await axios.get(
            `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${playerName}/${tagline}`,
            { headers: { "X-Riot-Token": RIOT_API_KEY } }
        );

        const puuid = summonerResponse.data.puuid;

        const numGames = 40;

        const matchHistoryResponse = await axios.get(
            `https://americas.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?start=0&count=${numGames}`,
            { headers: { "X-Riot-Token": RIOT_API_KEY } }
        );

        const matchIds = matchHistoryResponse.data;

        const matches = [];
        for (const matchId of matchIds) {
            const matchDataResponse = await axios.get(
                `https://americas.api.riotgames.com/tft/match/v1/matches/${matchId}`,
                { headers: { "X-Riot-Token": RIOT_API_KEY } }
            );
            matches.push(matchDataResponse.data);
        }

        const playerData = extractPlayerData(playerName, matches);
        const analyzedPlayerData = analyzePlayerData(playerData);
        const topAndBotResults = getTopAndBottomX(analyzedPlayerData, 3);
        const readableResult = mapResults(topAndBotResults);

        res.json(readableResult);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred" });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

const extractPlayerData = (playerName, matchData) => {
    const playerDetails = [];

    matchData.forEach((match) => {
        const participants = match.info.participants;

        const player = participants.find(
            (participant) =>
                participant.riotIdGameName.toLowerCase() === playerName.toLowerCase()
        );

        if (player) {
            // Extract relevant data
            playerDetails.push({
                placement: player.placement,
                traits: player.traits.map((trait) => ({
                    name: trait.name,
                    num_units: trait.num_units,
                    tier_current: trait.tier_current,
                })),
                units: player.units.map((unit) => ({
                    character_id: unit.character_id,
                    items: unit.itemNames,
                    tier: unit.tier,
                })),
            });
        }
    });

    return playerDetails;
};

const analyzePlayerData = (playerData) => {
    const traitStats = {};
    const unitStats = {};
    const itemStats = {};

    playerData.forEach((match) => {
        const { placement, traits, units } = match;

        traits.forEach((trait) => {
            if (!traitStats[trait.name]) {
                traitStats[trait.name] = { count: 0, totalPlacement: 0 };
            }
            traitStats[trait.name].count += 1;
            traitStats[trait.name].totalPlacement += placement;
        });

        units.forEach((unit) => {
            if (!unitStats[unit.character_id]) {
                unitStats[unit.character_id] = { count: 0, totalPlacement: 0 };
            }
            unitStats[unit.character_id].count += 1;
            unitStats[unit.character_id].totalPlacement += placement;

            unit.items.forEach((item) => {
                const key = `${unit.character_id}:${item}`;
                if (!itemStats[key]) {
                    itemStats[key] = { count: 0, totalPlacement: 0 };
                }
                itemStats[key].count += 1;
                itemStats[key].totalPlacement += placement;
            });
        });
    });

    const recommendations = {
        traits: [],
        units: [],
        items: [],
    };

    const sampleSizeNum = 3

    for (const [name, data] of Object.entries(traitStats)) {
        if (data.count > sampleSizeNum) {
            const avgPlacement = data.totalPlacement / data.count;
            recommendations.traits.push({ name, avgPlacement });
        }
    }

    for (const [id, data] of Object.entries(unitStats)) {
        if (data.count > sampleSizeNum) {
            const avgPlacement = data.totalPlacement / data.count;
            recommendations.units.push({ character_id: id, avgPlacement });
        }
    }

    for (const [key, data] of Object.entries(itemStats)) {
        if (data.count > sampleSizeNum) {
            const [unit, item] = key.split(":");
            const avgPlacement = data.totalPlacement / data.count;
            recommendations.items.push({ unit, item, avgPlacement });
        }
    }

    return recommendations;
};

const getTopAndBottomX = (data, count) => {
    const getSorted = (array) => {
        return array.slice().sort((a, b) => a.avgPlacement - b.avgPlacement);
    };

    return {
        traits: {
            top: getSorted(data.traits).slice(0, count),
            bottom: getSorted(data.traits).slice(-count).reverse(),
        },
        units: {
            top: getSorted(data.units).slice(0, count),
            bottom: getSorted(data.units).slice(-count).reverse(),
        },
        items: {
            top: getSorted(data.items).slice(0, count),
            bottom: getSorted(data.items).slice(-count).reverse(),
        },
    };
};

const championsData = JSON.parse(fs.readFileSync('data/tft-champion.json', 'utf8')).data;
const itemsData = JSON.parse(fs.readFileSync('data/tft-item.json', 'utf8')).data;
const traitsData = JSON.parse(fs.readFileSync('data/tft-trait.json', 'utf8')).data;

const buildImageUrl = (type, fileName) => {
    return `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/${type}/${fileName}`;
};

const getChampionData = (characterId) => {
    const entry = Object.values(championsData).find((champion) => champion.id === characterId);
    return entry || null;
};

const mapResults = (results) => {
    const mappedData = {
        traits: {
            top: results.traits.top.map(trait => ({
                name: traitsData[trait.name]?.name || trait.name,
                avgPlacement: trait.avgPlacement,
                image: buildImageUrl('tft-trait', traitsData[trait.name]?.image?.full || ''),
            })),
            bottom: results.traits.bottom.map(trait => ({
                name: traitsData[trait.name]?.name || trait.name,
                avgPlacement: trait.avgPlacement,
                image: buildImageUrl('tft-trait', traitsData[trait.name]?.image?.full || ''),
            })),
        },
        units: {
            top: results.units.top.map(unit => {
                const champion = getChampionData(unit.character_id);
                return {
                    name: champion?.name || unit.character_id,
                    avgPlacement: unit.avgPlacement,
                    image: buildImageUrl('tft-champion', champion?.image?.full || ''),
                };
            }),
            bottom: results.units.bottom.map(unit => {
                const champion = getChampionData(unit.character_id);
                return {
                    name: champion?.name || unit.character_id,
                    avgPlacement: unit.avgPlacement,
                    image: buildImageUrl('tft-champion', champion?.image?.full || ''),
                };
            }),
        },
        items: {
            top: results.items.top.map(item => {
                const champion = getChampionData(item.unit);
                return {
                    unit: champion?.name || item.unit,
                    unitImage: buildImageUrl('tft-champion', champion?.image?.full || ''),
                    item: itemsData[item.item]?.name || item.item,
                    avgPlacement: item.avgPlacement,
                    itemImage: buildImageUrl('tft-item', itemsData[item.item]?.image?.full || ''),
                };
            }),
            bottom: results.items.bottom.map(item => {
                const champion = getChampionData(item.unit);
                return {
                    unit: champion?.name || item.unit,
                    unitImage: buildImageUrl('tft-champion', champion?.image?.full || ''),
                    item: itemsData[item.item]?.name || item.item,
                    avgPlacement: item.avgPlacement,
                    itemImage: buildImageUrl('tft-item', itemsData[item.item]?.image?.full || ''),
                };
            }),
        },
    };
    return mappedData;
};