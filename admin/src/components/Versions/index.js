import React, { useCallback, useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import _ from "lodash";
import { useIntl } from "react-intl";
import { Box } from "@strapi/design-system/Box";
import { Stack } from "@strapi/design-system/Stack";
import { Divider } from "@strapi/design-system/Divider";
// import { TableLabel } from "@strapi/design-system/Text";
import { Select, Option } from "@strapi/design-system/Select";
import { Typography } from "@strapi/design-system/Typography";
import { Flex } from "@strapi/design-system/Flex";
import { Checkbox } from "@strapi/design-system/Checkbox";
import { Textarea } from "@strapi/design-system/Textarea";

import {
  useCMEditViewDataManager,
  useNotification,
} from "@strapi/helper-plugin";
import { Button } from "@strapi/design-system/Button";
import { format, parseISO } from "date-fns";

import { request, useQueryParams } from "@strapi/helper-plugin";

import { getTrad } from "../../utils";

const Versions = () => {
  const { formatMessage } = useIntl();
  const { push, replace } = useHistory();
  const location = useLocation();

  const {
    initialData,
    modifiedData,
    isCreatingEntry,
    slug,
    hasDraftAndPublish,
    layout,
    isDuplicatingEntry,
    onChange
  } = useCMEditViewDataManager();
  const toggleNotification = useNotification();

  if (!_.get(layout, "pluginOptions.versions.versioned", false)) {
    return null;
  }

  const [{ rawQuery }] = useQueryParams();
  const [hasComment, setHasComment] = useState(!!initialData?.versionComment);
  const [data, setData] = useState([]);
  const [publishedVersion, setPublishedVersion] = useState(undefined);

  useEffect(() => {
    setHasComment(!!initialData?.versionComment?.length)
  }, [initialData]);

  useEffect(() => {
    processVersions(modifiedData);
    //console.log(rawQuery, modifiedData);
  }, [modifiedData]);

  const processVersions = useCallback(
    (data) => {
      const versions = (data.versions || []).map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        label: `v${v.versionNumber}`,
        publishedAt: v.publishedAt,
        createdAt: v.createdAt,
      }));
      const sortedVersions = [...versions].sort(
        (a, b) => b.versionNumber - a.versionNumber
      );
      setData(sortedVersions);

      if (hasDraftAndPublish) {
        const publishedVersions = versions.filter((v) => v.publishedAt);
        if (data.publishedAt) {
          publishedVersions.push({
            versionNumber: data.versionNumber,
            publishedAt: data.publishedAt,
          });
        }
        const publishedVersion = _.maxBy(
          publishedVersions,
          (v) => v.versionNumber
        );

        setPublishedVersion(publishedVersion);
      }
    },
    [_, hasDraftAndPublish, setData, setPublishedVersion]
  );

  const handleChange = useCallback(
    (value) => {
      if (!value) {
        return;
      }

      const selectedVersion = data.find((v) => v.versionNumber === value);

      push({
        search: location.search,
        pathname: `/content-manager/collectionType/${slug}/${selectedVersion.id}`,
      });
    },
    [data, push, slug]
  );

  const onSaveClick = useCallback(async () => {
    const {
      createdAt,
      createdBy,
      publishedAt,
      updatedAt,
      updatedBy,
      id,
      ...newData
    } = modifiedData;

    try {
      const result = await request(
        `/content-versioning/${slug}/save${rawQuery}`,
        {
          method: "POST",
          body: {
            ...newData,
            id: id,
          },
        }
      );

      replace({
        search: location.search,
        pathname: `/content-manager/collectionType/${slug}/${result.id}`,
      });
    } catch (e) {
      const name = _.get(e, "response.payload.error.name");
      const message = _.get(e, "response.payload.error.message");
      let notificationMessage = "Error";
      if (name && message) {
        notificationMessage = `${name}: ${message}`;
      }
      toggleNotification({
        type: "warning",
        message: notificationMessage,
      });
    }
  }, [modifiedData, push, request, slug]);

  return (
    <Box
      as="aside"
      aria-labelledby="versioning-informations"
      background="neutral0"
      borderColor="neutral150"
      hasRadius
      paddingBottom={4}
      paddingLeft={4}
      paddingRight={4}
      paddingTop={6}
      shadow="tableShadow"
    >
      <Typography
        variant="sigma"
        textColor="neutral600"
        id="versioning-informations"
      >
        {formatMessage({
          id: getTrad("components.Edit.versions"),
          defaultMessage: "Versions",
        })}
      </Typography>
      <Box paddingTop={2} paddingBottom={6}>
        <Divider />
      </Box>

      <Stack size={4}>
        {publishedVersion && (
          <div>
            <Typography fontWeight="bold">
              {formatMessage({
                id: getTrad("containers.Edit.currentPublishedVersion"),
                defaultMessage: "Published version",
              })}
            </Typography>
            <div>
              <Typography variant="pi">{`v${publishedVersion.versionNumber}`}</Typography>{" "}
              <Typography variant="pi" color="Neutral600">
                {format(
                  parseISO(publishedVersion.publishedAt),
                  "MMM d, yyyy HH:mm"
                )}
              </Typography>
            </div>
          </div>
        )}
        {!isCreatingEntry && (
          <div style={{ marginBottom: 20 }}>
            <Typography fontWeight="bold">
              {formatMessage({
                id: getTrad("containers.Edit.currentShowedVersion"),
                defaultMessage: "Currently shown version",
              })}
            </Typography>
            <div>
              <Typography variant="pi">v{initialData.versionNumber}</Typography>{" "}
              <Typography variant="pi" textColor="neutral600">
                {format(parseISO(initialData.createdAt), "MMM d, yyyy HH:mm")}
              </Typography>
            </div>
          </div>
        )}
        {!isDuplicatingEntry && data.length > 0 && (
          <Select
            name={"version-select"}
            placeholder={formatMessage({
              id: getTrad("components.Edit.versionSelectPlaceholder"),
              defaultMessage: "Select version",
            })}
            label={formatMessage({
              id: getTrad("components.Edit.versionChangeVersion"),
              defaultMessage: "Change to version",
            })}
            onChange={handleChange}
          >
            {data.map((option) => {
              return (
                <Option
                  key={option.versionNumber}
                  value={option.versionNumber}
                  startIcon={
                    <div
                      style={{
                        height: "6px",
                        borderRadius: "50%",
                        width: "6px",
                        background: option.publishedAt
                          ? "rgb(50, 128, 72)"
                          : "rgb(12, 117, 175)",
                      }}
                    />
                  }
                >
                  {`${option.label} ${format(
                    parseISO(option.createdAt),
                    "MMM d, yyyy HH:mm"
                  )}`}
                </Option>
              );
            })}
          </Select>
        )}

        <Checkbox
          onValueChange={(value) => {
            setHasComment(value);
            if (!value) {
              onChange({ target: { name: 'versionComment', value: undefined, type: 'textarea' } })
            }
          }}
          value={hasComment}
          type="checkbox"
        >
          {formatMessage({
            id: getTrad("containers.Edit.toggleComment"),
            defaultMessage: "Save new version",
          })}
        </Checkbox>
        {hasComment && (
          <Textarea name="versionComment" onChange={(comment) => onChange(comment)}>
            {modifiedData?.versionComment}
          </Textarea>
        )}

        {/* TODO: preview for FE app */}
        {/* {!isCreatingEntry && (
          <Button variant="secondary">
            {formatMessage({
              id: getTrad("containers.Edit.buttonPreview"),
              defaultMessage: "Preview",
            })}
          </Button>
        )} */}
        <Button
          variant="secondary"
          fullWidth
          onClick={onSaveClick}
        /*
      ! Enabled before working patch of save button
      disabled={isCreatingEntry || isDuplicatingEntry}
      */
        >
          {formatMessage({
            id: getTrad("containers.Edit.buttonSave"),
            defaultMessage: "Save new version",
          })}
        </Button>
      </Stack>
    </Box>
  );
};

export default Versions;
