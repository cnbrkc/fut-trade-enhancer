import { sendRequest } from "../../utils/networkUtil";
import { getValue, setValue } from "../repository";
import { getUserPlatform } from "../user";

const fetchPrices = async (items) => {
  const result = new Map();

  const missingIds = new Set();

  for (const item of items) {
    if (!item.definitionId) {
      continue;
    }

    const priceDetail = getValue(`${item.definitionId}_in-house_price`);
    if (priceDetail) {
      result.set(`${item.definitionId}_in-house_price`, priceDetail.price);
    } else {
      missingIds.add(item.definitionId);
    }
  }

  const pendingPromises = [];

  if (missingIds.size) {
    pendingPromises.push(fetchPricesFromServer(missingIds, result));
  }

  await Promise.all(pendingPromises);

  return result;
};

export const fetchSolvableSbcs = async (payload) => {
  const response = await sendRequest(
    "https://api.futhelpers.com/sbcSolver",
    "POST",
    `${Math.floor(+new Date())}_fetchSolvableSbcs`,
    {
      playerIds: payload,
    }
  );
  return JSON.parse(response);
};

export const fetchSbcs = async (challengeId, payload) => {
  const response = await sendRequest(
    `https://api.futhelpers.com/sbcsSolutions?sbcId=${challengeId}`,
    "POST",
    `${Math.floor(+new Date())}_sbcSolution_${challengeId}`,
    {
      playerIds: payload,
    }
  );
  return JSON.parse(response);
};

const fetchPricesFromServer = async (defIds, result) => {
  const idsArray = Array.from(defIds);
  const platform = getUserPlatform();
  while (idsArray.length) {
    try {
      const defIds = idsArray.splice(0, 30);
      const url = `https://api.futhelpers.com/auction?platform=${platform}&defIds=${defIds.join(
        ","
      )}`;
      const response = await fetch(url, {
        headers: {
          Accept: "'application/json'",
          "Content-Type": "'application/json'",
        },
        method: "GET",
      });

      const priceResponse = await response.json();

      for (const id of [...defIds]) {
        if (!priceResponse[id] || !priceResponse[id][platform]) {
          continue;
        }
        const prices = priceResponse[id][platform].prices;
        const cardPrice = prices ? prices[0].price : 0;
        if (!cardPrice) {
          continue;
        }

        const cacheKey = `${id}_in-house_price`;
        const cacheValue = {
          expiryTimeStamp: new Date(Date.now() + 15 * 60 * 1000),
          price: cardPrice,
        };

        setValue(cacheKey, cacheValue);
        result.set(cacheKey, cardPrice);
      }
    } catch (err) {
      console.log(err);
    }
  }
};
export default {
  fetchPrices,
};
