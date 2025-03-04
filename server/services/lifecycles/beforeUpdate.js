"use strict";
const _ = require("lodash");
const { isLocalizedContentType } = require("../../utils");

const beforeUpdate = async (event) => {
  const { params } = event;
  const { data } = params;

  const model = await strapi.getModel(event.model.uid);
  const attrName = _.snakeCase(model.info.singularName)
  const collectionName = _.snakeCase(model.collectionName)
  const isLocalized = isLocalizedContentType(model)
  
  if (data?.publishedAt) {
    const item = await strapi.db.query(event.model.uid).findOne({ where: params.where });

    await strapi.db.query(event.model.uid).update({
      where: {
        id: item.id,
      },
      data: {
        isVisibleInListView: true,
      },
    });

    const where = {
      vuid: item.vuid,
      id: {
        $ne: item.id,
      }
    }
    if (isLocalized) where.locale = item.locale

    await strapi.db.query(event.model.uid).updateMany({
      where,
      data: {
        publishedAt: null, // not when creating
        isVisibleInListView: false,
      },
    });

    // Relink logic for localizations
    if (isLocalized) {
      const latestInLocales = (await strapi.db.connection.raw(
        `SELECT a.id, a.locale, a.version_number, a.published_at
      FROM ${collectionName} a WHERE NOT EXISTS (
        SELECT 1 FROM ${collectionName} WHERE locale=a.locale AND vuid=a.vuid AND (
         CASE WHEN a.published_at is null THEN (
           published_at is not null OR version_number > a.version_number
        )
        ELSE published_at is not null AND version_number > a.version_number
        END
        )
      ) AND vuid = '${item.vuid}'`
      ))
      const latestByLocale = {};
      for (const latest of latestInLocales.rows) {
        latestByLocale[latest.locale] = latest.id
      }

      // !set the current as latest in locale
      latestByLocale[item.locale] = item.id

      const allVersionsOtherLocales = (
        await strapi.db.query(event.model.uid).findMany({
          where: {
            vuid: item.vuid,
            locale: {
              $ne: item.locale,
            }
          },
        })
      )

      for (const entity of allVersionsOtherLocales) {
        await strapi.db.connection.raw(
          `DELETE FROM ${collectionName}_localizations_links WHERE ${attrName}_id=${entity.id}`
        );

        const latestIds = Object.values(_.omit(latestByLocale, entity.locale))
        const sqlValues = latestIds.map((latest) => `(${entity.id}, ${latest})`)
        if (!sqlValues?.length) continue;

        await strapi.db.connection.raw(
          `INSERT INTO ${collectionName}_localizations_links (${attrName}_id, inv_${attrName}_id) VALUES ` + sqlValues.join(",")
        );
      }
    }

  }
};

module.exports = beforeUpdate;
